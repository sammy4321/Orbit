const { ChatOpenAI } = require("@langchain/openai");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const {
  HumanMessage,
  AIMessage,
  SystemMessage,
} = require("@langchain/core/messages");

function getSystemPrompt() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  return `You are Orbit, a helpful AI assistant built into a web browser.
Today's date is ${dateStr}.

You have access to real-time web search. To search, output EXACTLY this tag on its own line with nothing else:

<SEARCH>your search query here</SEARCH>

YOU MUST SEARCH when the question involves ANY of these:
- Dates, schedules, upcoming events, or "when is"
- Live scores, match results, or sports
- Current prices, stock/crypto values
- News, recent happenings, or "latest"
- Weather or forecasts
- People's current roles, ages, or status
- Product releases, availability, or reviews
- Anything that could have changed after your training cutoff
- Anything where being wrong would be worse than taking a moment to search

When in doubt, SEARCH. It is always better to search and give accurate info than to guess from memory.

Only skip searching for:
- Pure coding/programming help
- Math or logic problems
- Creative writing
- Explaining well-established concepts (e.g. "what is photosynthesis")
- General conversation / greetings

After receiving search results, answer using those results. You may search multiple times if needed.`;
}

async function tavilySearch(query, tavilyKey) {
  console.log("[Orbit Agent] Tavily search for:", query);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: tavilyKey,
      query,
      max_results: 5,
      include_answer: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[Orbit Agent] Tavily API error:", res.status, errText);
    return `Search failed (HTTP ${res.status}). Please check your Tavily API key.`;
  }

  const data = await res.json();

  let formatted = "";
  if (data.answer) {
    formatted += `Quick answer: ${data.answer}\n\n`;
  }
  if (data.results?.length) {
    formatted += data.results
      .map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.content}`
      )
      .join("\n\n");
  }

  console.log(`[Orbit Agent] Tavily returned ${data.results?.length || 0} results`);
  return formatted || "No search results found.";
}

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
    timeout: 60000,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  });
}

function toLangChainMessages(messages) {
  return messages.map((m) => {
    if (m.role === "system") return new SystemMessage(m.content);
    if (m.role === "assistant") return new AIMessage(m.content);
    return new HumanMessage(m.content);
  });
}

const SEARCH_TAG_RE = /<SEARCH>\s*([\s\S]*?)\s*<\/SEARCH>/i;
const MAX_SEARCH_ROUNDS = 3;
const LLM_TIMEOUT_MS = 60000;

function invokeWithTimeout(model, messages) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("LLM request timed out after 60 seconds. The model may be overloaded — try a different one in Settings.")),
      LLM_TIMEOUT_MS
    );
    model
      .invoke(messages)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

async function chat(messages, apiKey, modelName, tavilyKey, provider = "openrouter") {
  if (!apiKey?.trim() || !modelName?.trim()) {
    const providerLabel = provider === "gemini" ? "Gemini" : "OpenRouter";
    return {
      error:
        `Please set your ${providerLabel} API key and model in Settings → AI Settings.`,
    };
  }
  if (!tavilyKey?.trim()) {
    return {
      error:
        "Please set your Tavily API key in Settings → AI Settings to enable web search.",
    };
  }

  try {
    const model = createModel(apiKey.trim(), modelName.trim(), provider);

    const lcMessages = [
      new SystemMessage(getSystemPrompt()),
      ...toLangChainMessages(messages),
    ];

    for (let round = 0; round < MAX_SEARCH_ROUNDS; round++) {
      console.log(`[Orbit Agent] LLM call round ${round + 1}, sending ${lcMessages.length} messages to ${modelName}`);
      const t0 = Date.now();
      const response = await invokeWithTimeout(model, lcMessages);
      console.log(`[Orbit Agent] LLM responded in ${Date.now() - t0}ms`);
      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      console.log(`[Orbit Agent] Response preview: ${text.substring(0, 120)}`);

      const match = SEARCH_TAG_RE.exec(text);
      if (!match) {
        console.log("[Orbit Agent] Final answer (no search tag), length:", text.length);
        return { content: text };
      }

      const query = match[1].trim();
      if (!query) {
        console.log("[Orbit Agent] Empty search query, returning text as-is");
        return { content: text.replace(SEARCH_TAG_RE, "").trim() || "No response." };
      }

      const results = await tavilySearch(query, tavilyKey.trim());

      lcMessages.push(new AIMessage(text));
      lcMessages.push(
        new HumanMessage(
          `Here are the web search results for "${query}":\n\n${results}\n\nNow answer the original question using these results.`
        )
      );
    }

    console.log("[Orbit Agent] Max search rounds reached, doing final call");
    const finalResponse = await invokeWithTimeout(model, lcMessages);
    return { content: finalResponse.content };
  } catch (err) {
    console.error("[Orbit Agent] Error:", err.message);
    return { error: err.message || "Failed to get response from LLM." };
  }
}

module.exports = { chat };
