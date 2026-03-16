const { ChatOpenAI } = require("@langchain/openai");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

const LLM_TIMEOUT_MS = 60000;

function createModel(apiKey, modelName, provider) {
  if (provider === "gemini") {
    return new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName,
      thinkingConfig: { thinkingBudget: 0 },
    });
  }

  return new ChatOpenAI({
    apiKey,
    model: modelName,
    timeout: LLM_TIMEOUT_MS,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  });
}

function invokeWithTimeout(model, messages) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "Browser agent model timed out after 60 seconds. Try a faster model in Settings."
          )
        ),
      LLM_TIMEOUT_MS
    );
    model
      .invoke(messages)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function extractJsonBlock(text) {
  const trimmed = String(text || "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Model did not return valid JSON.");
  }
  return trimmed.slice(start, end + 1);
}

function getSystemPrompt() {
  return `You are Orbit Browser Agent, an autonomous but safe web automation planner.

You receive:
- user_goal: what the user wants done
- conversation: recent user/assistant messages
- page: current browser snapshot with URL, title, visible text, and interactive elements
- execution_feedback: what happened after the previous planned actions
- attachments: optional files (resume, docs, images) that should be used as context when relevant

Return ONLY valid JSON following this schema:
{
  "status": "needs_action" | "done" | "error",
  "assistantMessage": "short user-facing update",
  "actions": [
    {
      "type": "navigate" | "click" | "type" | "press" | "scroll" | "wait",
      "targetId": "element id from page.elements when relevant",
      "url": "for navigate",
      "text": "for type",
      "key": "for press e.g. Enter",
      "direction": "down|up for scroll",
      "amount": 500,
      "ms": 1200,
      "submit": true
    }
  ]
}

Rules:
- Be precise and conservative. Never hallucinate element ids.
- Use only targetId values that exist in page.elements.
- Prefer one or two actions at a time.
- Assume user permission is already granted for web actions. Do NOT ask for confirmation.
- Do NOT mark done only because a keyword appears somewhere on the page (for example in a nav bar).
- For goals like "go to", "open", "navigate", or "click", first perform the navigation/click actions and then verify the resulting page context.
- Use execution_feedback and conversation to continue until the requested destination/section is actually reached.
- If page is already complete for user_goal, return status="done".
- If blocked, return status="error" with clear assistantMessage and empty actions.
- Do not include markdown. Output JSON only.`;
}

function buildPlannerHumanContent(input, provider) {
  const attachments = Array.isArray(input?.attachments) ? input.attachments : [];
  const safeInput = {
    ...input,
    attachments: attachments.map((a, i) => ({
      index: i + 1,
      name: a?.name || `attachment-${i + 1}`,
      mimeType: a?.mimeType || "application/octet-stream",
    })),
  };

  if (provider === "gemini" || attachments.length === 0) {
    return JSON.stringify(safeInput);
  }

  const parts = [{ type: "text", text: JSON.stringify(safeInput) }];

  for (const file of attachments.slice(0, 4)) {
    const mimeType = String(file?.mimeType || "");
    const dataUrl = String(file?.dataUrl || "");
    const name = String(file?.name || "attachment");
    if (!dataUrl.startsWith("data:")) continue;

    if (mimeType.startsWith("image/")) {
      parts.push({ type: "image_url", image_url: { url: dataUrl } });
      continue;
    }

    if (mimeType === "application/pdf") {
      parts.push({
        type: "file",
        file: {
          filename: name,
          file_data: dataUrl,
        },
      });
    }
  }

  return parts;
}

function sanitizePlan(raw) {
  const fallback = {
    status: "error",
    assistantMessage: "I couldn't generate a valid browser plan for this step.",
    actions: [],
  };

  const allowedStatus = new Set(["needs_action", "done", "error"]);
  const allowedActionTypes = new Set([
    "navigate",
    "click",
    "type",
    "press",
    "scroll",
    "wait",
  ]);

  try {
    const status =
      raw?.status === "needs_confirmation"
        ? "needs_action"
        : allowedStatus.has(raw?.status)
        ? raw.status
        : "error";
    const actions = Array.isArray(raw?.actions)
      ? raw.actions
          .filter((a) => a && allowedActionTypes.has(a.type))
          .slice(0, 3)
          .map((a) => ({
            type: a.type,
            targetId: typeof a.targetId === "string" ? a.targetId : "",
            url: typeof a.url === "string" ? a.url : "",
            text: typeof a.text === "string" ? a.text : "",
            key: typeof a.key === "string" ? a.key : "",
            direction: a.direction === "up" ? "up" : "down",
            amount:
              typeof a.amount === "number" && Number.isFinite(a.amount)
                ? Math.max(50, Math.min(3000, Math.round(a.amount)))
                : 500,
            ms:
              typeof a.ms === "number" && Number.isFinite(a.ms)
                ? Math.max(100, Math.min(10000, Math.round(a.ms)))
                : 900,
            submit: Boolean(a.submit),
          }))
      : [];

    return {
      status,
      assistantMessage:
        typeof raw?.assistantMessage === "string" && raw.assistantMessage.trim()
          ? raw.assistantMessage.trim()
          : status === "done"
          ? "Done."
          : "Working on it.",
      actions,
    };
  } catch {
    return fallback;
  }
}

async function planStep(input, apiKey, modelName, provider = "openrouter") {
  if (!apiKey?.trim() || !modelName?.trim()) {
    const providerLabel = provider === "gemini" ? "Gemini" : "OpenRouter";
    return {
      error: `Please set your ${providerLabel} API key and model in Settings → AI Settings.`,
    };
  }

  try {
    const model = createModel(apiKey.trim(), modelName.trim(), provider);
    const messages = [
      new SystemMessage(getSystemPrompt()),
      new HumanMessage(buildPlannerHumanContent(input, provider)),
    ];
    const response = await invokeWithTimeout(model, messages);
    const text =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);
    const jsonText = extractJsonBlock(text);
    const parsed = JSON.parse(jsonText);
    return { plan: sanitizePlan(parsed) };
  } catch (err) {
    return { error: err.message || "Failed to generate browser plan." };
  }
}

module.exports = { planStep };
