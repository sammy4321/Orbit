const SETTINGS_URL = "orbit://settings";
const HOME_URL = "orbit://home";

const tabsContainer = document.getElementById("tabs");
const newTabBtn = document.getElementById("new-tab-btn");
const webviewContainer = document.getElementById("webview-container");
const urlBar = document.getElementById("url-bar");
const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnReload = document.getElementById("btn-reload");

let tabs = [];
let activeTabId = null;
let tabIdCounter = 0;

// ── Helpers ──────────────────────────────────────

function normalizeUrl(input) {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^orbit(-vault)?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return "https://" + trimmed;
  return "https://www.google.com/search?q=" + encodeURIComponent(trimmed);
}

function getTab(id) {
  return tabs.find((t) => t.id === id);
}

function getActiveWebview() {
  const tab = getTab(activeTabId);
  if (!tab || tab.internalUrl) return null;
  return tab.view;
}

// ── Tab rendering ────────────────────────────────

function renderTabs() {
  tabsContainer.innerHTML = "";

  tabs.forEach((tab) => {
    const el = document.createElement("button");
    el.className = "tab" + (tab.id === activeTabId ? " active" : "");

    if (tab.loading) {
      const spinner = document.createElement("span");
      spinner.className = "tab-spinner";
      el.appendChild(spinner);
    } else if (tab.favicon) {
      const icon = document.createElement("img");
      icon.className = "tab-favicon";
      icon.src = tab.favicon;
      icon.draggable = false;
      icon.addEventListener("error", () => { icon.style.display = "none"; });
      el.appendChild(icon);
    }

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "New Tab";
    el.appendChild(title);

    const close = document.createElement("span");
    close.className = "tab-close";
    close.textContent = "\u00d7";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(close);

    el.addEventListener("click", () => activateTab(tab.id));
    tabsContainer.appendChild(el);
  });
}

// ── Tab lifecycle ────────────────────────────────

function isInternalUrl(url) {
  return url.startsWith("orbit://");
}

const SETTINGS_PANELS = {
  history: {
    label: "History",
    icon: `<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7a6.99 6.99 0 0 1-4.95-2.05l-1.41 1.41A8.96 8.96 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>`,
    render: () => `
      <div class="settings-content-header">
        <h2>History</h2>
        <div class="history-actions">
          <button class="history-icon-btn" id="refresh-history-btn" title="Refresh">
            <svg viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          <button class="history-icon-btn history-icon-btn-danger" id="clear-history-btn" title="Clear all history">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
      <ul class="history-list" id="history-list">
        <li class="history-empty">Loading...</li>
      </ul>
      <div class="confirm-modal" id="clear-history-modal">
        <div class="confirm-modal-backdrop"></div>
        <div class="confirm-modal-dialog">
          <div class="confirm-modal-icon confirm-modal-icon-danger">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </div>
          <h3 class="confirm-modal-title">Clear all history?</h3>
          <p class="confirm-modal-message">This will permanently remove all browsing history. This action cannot be undone.</p>
          <div class="confirm-modal-actions">
            <button class="confirm-modal-btn confirm-modal-cancel" id="clear-history-cancel">Cancel</button>
            <button class="confirm-modal-btn confirm-modal-confirm" id="clear-history-confirm">Clear</button>
          </div>
        </div>
      </div>
    `,
    onMount: async (content) => {
      const list = content.querySelector("#history-list");
      const refreshBtn = content.querySelector("#refresh-history-btn");
      const clearBtn = content.querySelector("#clear-history-btn");
      const modal = content.querySelector("#clear-history-modal");
      const cancelBtn = content.querySelector("#clear-history-cancel");
      const confirmBtn = content.querySelector("#clear-history-confirm");

      const PAGE_SIZE = 10;
      let offset = 0;
      let hasMore = true;
      let isLoading = false;

      function createHistoryItem(entry) {
        const li = document.createElement("li");
        li.className = "history-item";

        const time = document.createElement("span");
        time.className = "history-time";
        const d = new Date(entry.visited_at + "Z");
        time.textContent = d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
          + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

        const info = document.createElement("div");
        info.className = "history-info";

        const title = document.createElement("span");
        title.className = "history-title";
        title.textContent = entry.title || entry.url;

        const url = document.createElement("span");
        url.className = "history-url";
        url.textContent = entry.url;
        url.title = entry.url;
        url.addEventListener("click", () => createTab(entry.url));

        info.appendChild(title);
        info.appendChild(url);
        li.appendChild(time);
        li.appendChild(info);
        return li;
      }

      function onScroll() {
        if (!hasMore || isLoading) return;
        const el = content;
        const threshold = 100;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
          loadMore();
        }
      }

      async function loadMore() {
        if (isLoading || !hasMore) return;
        isLoading = true;

        const loadMarker = list.querySelector(".history-load-more");
        if (loadMarker) {
          loadMarker.classList.add("loading");
          loadMarker.textContent = "Loading...";
        }

        const entries = await window.orbit.history.get(PAGE_SIZE, offset);

        if (loadMarker) loadMarker.remove();
        if (entries.length < PAGE_SIZE) hasMore = false;

        for (const entry of entries) {
          list.appendChild(createHistoryItem(entry));
        }
        offset += entries.length;

        if (hasMore && entries.length > 0) {
          const marker = document.createElement("li");
          marker.className = "history-load-more";
          marker.style.cssText = "visibility:hidden;height:1px;";
          list.appendChild(marker);
        }
        isLoading = false;
      }

      async function loadHistory(reset = true) {
        if (reset) {
          list.innerHTML = '<li class="history-empty">Loading...</li>';
          offset = 0;
          hasMore = true;
          isLoading = true;
        }

        const entries = await window.orbit.history.get(PAGE_SIZE, 0);

        if (reset) {
          list.innerHTML = "";
          isLoading = false;
        }
        if (!entries.length && reset) {
          list.innerHTML = '<li class="history-empty">No history yet.</li>';
          return;
        }
        for (const entry of entries) {
          list.appendChild(createHistoryItem(entry));
        }
        offset = entries.length;
        hasMore = entries.length >= PAGE_SIZE;

        if (hasMore) {
          const marker = document.createElement("li");
          marker.className = "history-load-more";
          marker.style.visibility = "hidden";
          marker.style.height = "1px";
          list.appendChild(marker);
        }
      }

      content.addEventListener("scroll", onScroll);
      refreshBtn.addEventListener("click", () => loadHistory(true));

      function closeModal() {
        modal.classList.remove("open");
        document.removeEventListener("keydown", handleEscape);
      }

      function handleEscape(e) {
        if (e.key === "Escape" && modal.classList.contains("open")) {
          closeModal();
        }
      }

      clearBtn.addEventListener("click", () => {
        modal.classList.add("open");
        document.addEventListener("keydown", handleEscape);
      });

      cancelBtn.addEventListener("click", closeModal);
      modal.querySelector(".confirm-modal-backdrop").addEventListener("click", closeModal);

      confirmBtn.addEventListener("click", async () => {
        closeModal();
        await window.orbit.history.clear();
        loadHistory(true);
      });

      loadHistory(true);
    },
  },
  "ai-settings": {
    label: "AI Settings",
    icon: `<svg viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></path></svg>`,
    render: () => `
      <div class="settings-panel-centered">
        <div class="settings-panel-centered-inner">
          <div class="settings-content-header">
            <h2>AI Settings</h2>
          </div>
      <div class="settings-field settings-field-inline">
        <div class="settings-field-row">
          <label class="settings-field-label" for="ai-api-key-input">OpenRouter API Key</label>
          <input type="password" id="ai-api-key-input" class="settings-input" placeholder="sk-..." autocomplete="off" />
        </div>
      </div>
      <div class="settings-field settings-field-inline">
        <div class="settings-field-row">
          <label class="settings-field-label" for="ai-model-input">OpenRouter Model</label>
          <input type="text" id="ai-model-input" class="settings-input" placeholder="e.g. openai/gpt-4o, anthropic/claude-3.5-sonnet" autocomplete="off" />
        </div>
      </div>
      <div class="settings-field-row" style="margin-top: 16px;">
        <button class="settings-btn" id="save-ai-settings-btn">Save</button>
      </div>
        </div>
      </div>
    `,
    onMount: async (content) => {
      const keyInput = content.querySelector("#ai-api-key-input");
      const modelInput = content.querySelector("#ai-model-input");
      const saveBtn = content.querySelector("#save-ai-settings-btn");

      const [key, model] = await Promise.all([window.orbit.apiKey.get(), window.orbit.aiModel.get()]);
      if (key) keyInput.value = key;
      if (model) modelInput.value = model;

      saveBtn.addEventListener("click", async () => {
        await window.orbit.apiKey.set(keyInput.value.trim());
        await window.orbit.aiModel.set(modelInput.value.trim());
        saveBtn.textContent = "Saved!";
        setTimeout(() => { saveBtn.textContent = "Save"; }, 1500);
      });
    },
  },
  "file-vault": {
    label: "File Vault",
    icon: `<svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>`,
    render: () => `
      <div class="settings-content-header vault-header">
        <h2>File Vault</h2>
        <button class="settings-btn vault-upload-btn" id="vault-upload-btn">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload PDF
        </button>
      </div>
      <div class="vault-files" id="vault-files">
        <div class="vault-loading">Loading...</div>
      </div>
      <div class="vault-empty" id="vault-empty" style="display:none">
        <div class="vault-empty-icon">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <p>No files in vault yet</p>
        <span>Upload a PDF to get started</span>
      </div>
    `,
    onMount: async (content) => {
      const filesContainer = content.querySelector("#vault-files");
      const emptyState = content.querySelector("#vault-empty");
      const uploadBtn = content.querySelector("#vault-upload-btn");

      const PDF_ICON = `<svg viewBox="0 0 24 24" class="vault-file-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;

      function renderFile(file) {
        const card = document.createElement("button");
        card.className = "vault-file-card";
        card.type = "button";
        const d = new Date(file.uploaded_at + "Z");
        const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        card.innerHTML = `
          <span class="vault-file-icon-wrap">${PDF_ICON}</span>
          <span class="vault-file-name" title="${file.original_name}">${file.original_name}</span>
          <span class="vault-file-date">${dateStr}</span>
          <span class="vault-file-action">Open in tab →</span>
        `;
        card.addEventListener("click", () => {
          createTab(`orbit-vault://${file.id}`, { title: file.original_name });
        });
        return card;
      }

      async function loadVault() {
        const files = await window.orbit.vault.list();
        filesContainer.innerHTML = "";
        filesContainer.style.display = files.length ? "grid" : "none";
        emptyState.style.display = files.length ? "none" : "flex";

        for (const file of files) {
          filesContainer.appendChild(renderFile(file));
        }
      }

      uploadBtn.addEventListener("click", async () => {
        const added = await window.orbit.vault.add();
        if (added) loadVault();
      });

      loadVault();
    },
  },
  "home-page": {
    label: "Home Page",
    icon: `<svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M3 12l2-2m0 0l7-7 7 7m-14 0v9a1 1 0 0 0 1 1h3m10-10l2 2m-2-2v9a1 1 0 0 1-1 1h-3m-4 0a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2z"/></svg>`,
    render: () => `
      <div class="settings-panel-centered">
        <div class="settings-panel-centered-inner">
          <div class="settings-content-header">
            <h2>Home Page</h2>
          </div>
      <div class="settings-field">
        <label class="settings-field-label">Quick options</label>
        <div class="home-page-presets">
          <button class="home-preset-btn" data-url="orbit://home">Orbit Home</button>
          <button class="home-preset-btn" data-url="https://www.google.com">Google</button>
          <button class="home-preset-btn" data-url="https://duckduckgo.com">DuckDuckGo</button>
        </div>
      </div>
      <div class="settings-field">
        <label class="settings-field-label" for="home-url-input">Custom URL</label>
        <div class="settings-field-row">
          <input type="text" id="home-url-input" class="settings-input" placeholder="https://example.com or orbit://home" autocomplete="off" />
          <button class="settings-btn" id="save-home-btn">Save</button>
        </div>
      </div>
        </div>
      </div>
    `,
    onMount: async (content) => {
      const input = content.querySelector("#home-url-input");
      const saveBtn = content.querySelector("#save-home-btn");
      const presets = content.querySelectorAll(".home-preset-btn");

      const current = await window.orbit.homeUrl.get();
      input.value = current;

      presets.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.url === current);
        btn.addEventListener("click", () => {
          presets.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          input.value = btn.dataset.url;
        });
      });

      const save = async () => {
        const value = input.value.trim() || "orbit://home";
        await window.orbit.homeUrl.set(value);
        saveBtn.textContent = "Saved!";
        setTimeout(() => { saveBtn.textContent = "Save"; }, 1500);
        presets.forEach((btn) => btn.classList.toggle("active", btn.dataset.url === value));
      };

      saveBtn.addEventListener("click", save);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") save();
      });
    },
  },
};

const INTERNAL_PAGES = {
  [HOME_URL]: {
    title: "Orbit",
    build: (el) => {
      el.innerHTML = `
        <div class="chat-page">
          <div class="chat-messages">
            <div class="chat-messages-inner" id="chat-messages-inner">
              <div class="chat-welcome-block">
                <div class="chat-welcome">
                  <h1>What can I help with?</h1>
                  <p>Ask me anything — I'm your browsing assistant.</p>
                </div>
                <div class="chat-input-area" id="chat-input-area">
                  <div class="chat-input-box">
                    <button class="chat-attach-btn" title="Attach">
                      <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    </button>
                    <textarea class="chat-textarea" id="chat-input" placeholder="Message Orbit..." rows="1"></textarea>
                    <button class="chat-send-btn" id="chat-send-btn" title="Send" disabled>
                      <svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="chat-input-footer" id="chat-input-footer"></div>
        </div>
      `;

      const input = el.querySelector("#chat-input");
      const sendBtn = el.querySelector("#chat-send-btn");
      const messagesInner = el.querySelector("#chat-messages-inner");
      const inputArea = el.querySelector("#chat-input-area");
      const inputFooter = el.querySelector("#chat-input-footer");

      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 160) + "px";
        sendBtn.disabled = !input.value.trim();
      });

      function addMessage(role, text) {
        const welcome = messagesInner.querySelector(".chat-welcome");
        const welcomeBlock = messagesInner.querySelector(".chat-welcome-block");
        if (welcome) welcome.remove();
        if (welcomeBlock) {
          inputFooter.appendChild(inputArea);
          welcomeBlock.remove();
        }

        const msg = document.createElement("div");
        msg.className = "chat-msg " + role;

        const avatar = document.createElement("div");
        avatar.className = "chat-msg-avatar";
        avatar.textContent = role === "user" ? "Y" : "O";

        const body = document.createElement("div");
        body.className = "chat-msg-body";
        body.textContent = text;

        msg.appendChild(avatar);
        msg.appendChild(body);
        messagesInner.appendChild(msg);

        const container = el.querySelector(".chat-messages");
        container.scrollTop = container.scrollHeight;
      }

      function handleSend() {
        const text = input.value.trim();
        if (!text) return;
        addMessage("user", text);
        input.value = "";
        input.style.height = "auto";
        sendBtn.disabled = true;
      }

      sendBtn.addEventListener("click", handleSend);

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    },
  },
  [SETTINGS_URL]: {
    title: "Settings",
    build: (el) => {
      const layout = document.createElement("div");
      layout.className = "settings-layout";

      const sidebar = document.createElement("div");
      sidebar.className = "settings-sidebar";

      const sidebarTitle = document.createElement("div");
      sidebarTitle.className = "settings-sidebar-title";
      sidebarTitle.textContent = "Settings";
      sidebar.appendChild(sidebarTitle);

      const content = document.createElement("div");
      content.className = "settings-content";

      const panelKeys = Object.keys(SETTINGS_PANELS);

      function showPanel(key) {
        sidebar.querySelectorAll(".settings-nav-item").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.panel === key);
        });
        const panel = SETTINGS_PANELS[key];
        content.innerHTML = panel.render();
        if (panel.onMount) panel.onMount(content);
      }

      for (const key of panelKeys) {
        const panel = SETTINGS_PANELS[key];
        const btn = document.createElement("button");
        btn.className = "settings-nav-item";
        btn.dataset.panel = key;
        btn.innerHTML = panel.icon + panel.label;
        btn.addEventListener("click", () => showPanel(key));
        sidebar.appendChild(btn);
      }

      layout.appendChild(sidebar);
      layout.appendChild(content);
      el.appendChild(layout);

      showPanel(panelKeys[0]);
    },
  },
};

function createInternalPage(url) {
  const page = INTERNAL_PAGES[url];
  if (!page) return null;
  const el = document.createElement("div");
  el.className = "internal-page";
  if (page.build) {
    page.build(el);
  } else if (page.html) {
    el.innerHTML = page.html;
  }
  return { el, title: page.title };
}

async function createTab(url, options = {}) {
  const actualUrl = url ?? (await window.orbit.homeUrl.get());
  const id = ++tabIdCounter;
  const isInternal = isInternalUrl(actualUrl);

  let view;
  let tab;

  if (isInternal) {
    const internal = createInternalPage(actualUrl);
    view = internal.el;
    webviewContainer.appendChild(view);
    tab = { id, title: internal.title, view, zoomLevel: 0, internalUrl: actualUrl };
  } else {
    view = document.createElement("webview");
    view.src = actualUrl;
    view.setAttribute("autosize", "on");
    webviewContainer.appendChild(view);
    const initialTitle = options.title || "New Tab";
    tab = { id, title: initialTitle, view, zoomLevel: 0, internalUrl: null, favicon: null, loading: true };

    view.addEventListener("page-title-updated", (e) => {
      if (!options.title) {
        tab.title = e.title;
        renderTabs();
        window.orbit.history.add(view.getURL(), e.title);
      }
    });

    view.addEventListener("page-favicon-updated", (e) => {
      if (e.favicons && e.favicons.length) {
        tab.favicon = e.favicons[0];
        renderTabs();
      }
    });

    view.addEventListener("did-start-loading", () => {
      tab.loading = true;
      renderTabs();
      if (tab.id === activeTabId) btnReload.classList.add("spinning");
    });

    view.addEventListener("did-stop-loading", () => {
      tab.loading = false;
      renderTabs();
      if (tab.id === activeTabId) btnReload.classList.remove("spinning");
    });

    view.addEventListener("did-navigate", (e) => {
      if (tab.id === activeTabId) urlBar.value = e.url;
    });

    view.addEventListener("did-navigate-in-page", (e) => {
      if (e.isMainFrame && tab.id === activeTabId) urlBar.value = e.url;
    });
  }

  tabs.push(tab);
  activateTab(id);
  return tab;
}

function activateTab(id) {
  activeTabId = id;

  tabs.forEach((tab) => {
    tab.view.classList.toggle("active", tab.id === id);
  });

  const tab = getTab(id);
  if (tab) {
    urlBar.value = tab.internalUrl || tab.view.getURL?.() || tab.view.src || "";
  }

  renderTabs();
  if (typeof updateZoomLabel === "function") updateZoomLabel();
  const activeTab = getTab(id);
  if (activeTab?.loading) {
    btnReload.classList.add("spinning");
  } else {
    btnReload.classList.remove("spinning");
  }

  if (activeTab?.internalUrl === SETTINGS_URL || activeTab?.internalUrl === HOME_URL) {
    if (typeof closeAgentPanel === "function") closeAgentPanel();
  }
}

function closeTab(id) {
  const index = tabs.findIndex((t) => t.id === id);
  if (index === -1) return;

  const tab = tabs[index];
  tab.view.remove();
  tabs.splice(index, 1);

  if (tabs.length === 0) {
    window.orbit.closeWindow();
    return;
  }

  if (activeTabId === id) {
    const next = tabs[Math.min(index, tabs.length - 1)];
    activateTab(next.id);
  } else {
    renderTabs();
  }
}

// ── Navigation ───────────────────────────────────

function navigate(input) {
  const normalized = normalizeUrl(input);
  const wv = getActiveWebview();
  if (wv) {
    wv.src = normalized;
  } else {
    createTab(normalized);
  }
}

// ── Omnibox (suggestions) ────────────────────────

const suggestionsEl = document.getElementById("suggestions");
const urlBarAutocomplete = document.getElementById("url-bar-autocomplete");
let omniboxItems = [];
let omniboxIndex = -1;
let omniboxDebounce = null;

const SEARCH_SVG = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`;
const HISTORY_SVG = `<svg viewBox="0 0 24 24"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>`;

function measureTextWidth(text) {
  const span = document.createElement("span");
  span.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-size:13px;font-family:inherit;";
  span.textContent = text || " ";
  document.body.appendChild(span);
  const w = span.offsetWidth;
  span.remove();
  return w;
}

function getAutocompleteValue(item) {
  if (item.url) return item.url;
  return item.query || "";
}

function updateAutocompleteOverlay() {
  if (!urlBarAutocomplete || !omniboxItems.length || omniboxIndex < 0) {
    if (urlBarAutocomplete) {
      urlBarAutocomplete.textContent = "";
      urlBarAutocomplete.style.display = "none";
    }
    return;
  }
  const query = urlBar.value;
  const item = omniboxItems[omniboxIndex];
  const full = getAutocompleteValue(item);
  const q = query.trim().toLowerCase();
  let completion = "";
  if (q && full) {
    const fullLower = full.toLowerCase();
    const idx = fullLower.indexOf(q);
    if (idx >= 0) {
      completion = full.slice(idx + q.length);
    } else if (fullLower.startsWith(q)) {
      completion = full.slice(q.length);
    }
  }
  if (!completion) {
    urlBarAutocomplete.textContent = "";
    urlBarAutocomplete.style.display = "none";
    return;
  }
  urlBarAutocomplete.style.display = "flex";
  const spacer = document.createElement("span");
  spacer.style.visibility = "hidden";
  spacer.style.display = "inline-block";
  spacer.style.width = measureTextWidth(query) + "px";
  spacer.style.minWidth = spacer.style.width;
  spacer.textContent = query || "\u00a0";
  const completionSpan = document.createElement("span");
  completionSpan.className = "url-bar-autocomplete-tail";
  completionSpan.textContent = completion;
  completionSpan.style.color = "var(--text-dim)";
  urlBarAutocomplete.innerHTML = "";
  urlBarAutocomplete.appendChild(spacer);
  urlBarAutocomplete.appendChild(completionSpan);
}

function highlightMatch(text, query) {
  if (!query || !query.trim()) return text;
  const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${q})`, "gi");
  return text.replace(re, "<strong>$1</strong>");
}

function closeSuggestions() {
  suggestionsEl.classList.remove("open");
  omniboxItems = [];
  omniboxIndex = -1;
  urlBarAutocomplete.textContent = "";
  urlBarAutocomplete.style.display = "none";
}

function renderSuggestions() {
  suggestionsEl.innerHTML = "";
  if (!omniboxItems.length) { closeSuggestions(); return; }

  omniboxIndex = Math.max(0, Math.min(omniboxIndex, omniboxItems.length - 1));
  suggestionsEl.classList.add("open");

  const query = urlBar.value.trim();

  omniboxItems.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "suggestion" + (i === omniboxIndex ? " selected" : "");

    const icon = document.createElement("span");
    icon.className = "suggestion-icon " + (item.type === "history" ? "history-icon" : "search-icon");
    icon.innerHTML = item.type === "history" ? HISTORY_SVG : SEARCH_SVG;

    const text = document.createElement("div");
    text.className = "suggestion-text";

    const title = document.createElement("span");
    title.className = "suggestion-title";
    title.innerHTML = highlightMatch(item.title, query);
    text.appendChild(title);

    if (item.url) {
      const url = document.createElement("span");
      url.className = "suggestion-url";
      url.innerHTML = highlightMatch(item.url, query);
      text.appendChild(url);
    }

    row.appendChild(icon);
    row.appendChild(text);

    row.addEventListener("mousedown", (e) => {
      e.preventDefault();
      pickSuggestion(item);
    });

    suggestionsEl.appendChild(row);
  });

  updateAutocompleteOverlay();
}

function pickSuggestion(item) {
  closeSuggestions();
  if (item.url) {
    urlBar.value = item.url;
    navigate(item.url);
  } else {
    urlBar.value = item.query;
    navigate(item.query);
  }
  urlBar.blur();
}

async function updateSuggestions(query) {
  if (!query.trim()) { closeSuggestions(); return; }

  const items = [];

  try {
    const history = await window.orbit.history.search(query, 5);
    for (const h of history) {
      items.push({ type: "history", title: h.title || h.url, url: h.url });
    }
  } catch (_) {}

  items.push({ type: "search", title: `Search Google for "${query}"`, query });

  omniboxItems = items;
  omniboxIndex = 0;
  renderSuggestions();
}

urlBar.addEventListener("input", () => {
  clearTimeout(omniboxDebounce);
  omniboxDebounce = setTimeout(() => updateSuggestions(urlBar.value), 120);
  updateAutocompleteOverlay();
});

urlBar.addEventListener("focus", () => {
  if (urlBar.value.trim()) {
    urlBar.select();
    updateSuggestions(urlBar.value);
  }
});

urlBar.addEventListener("blur", () => {
  setTimeout(closeSuggestions, 150);
});

urlBar.addEventListener("keydown", (e) => {
  if (suggestionsEl.classList.contains("open")) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      omniboxIndex = Math.min(omniboxIndex + 1, omniboxItems.length - 1);
      renderSuggestions();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      omniboxIndex = Math.max(omniboxIndex - 1, -1);
      renderSuggestions();
      return;
    }
    if (e.key === "Escape") {
      closeSuggestions();
      return;
    }
    if ((e.key === "Tab" || e.key === "ArrowRight") && omniboxIndex >= 0 && omniboxItems[omniboxIndex]) {
      const item = omniboxItems[omniboxIndex];
      const full = getAutocompleteValue(item);
      const q = urlBar.value.trim().toLowerCase();
      if (q && full) {
        const fullLower = full.toLowerCase();
        const idx = fullLower.indexOf(q);
        if (idx >= 0 && idx + q.length < full.length) {
          e.preventDefault();
          urlBar.value = full;
          updateAutocompleteOverlay();
          return;
        }
      }
    }
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (omniboxIndex >= 0 && omniboxItems[omniboxIndex]) {
      pickSuggestion(omniboxItems[omniboxIndex]);
    } else {
      closeSuggestions();
      navigate(urlBar.value);
      urlBar.blur();
    }
  }
});

btnBack.addEventListener("click", () => {
  const wv = getActiveWebview();
  if (wv?.canGoBack()) wv.goBack();
});

btnForward.addEventListener("click", () => {
  const wv = getActiveWebview();
  if (wv?.canGoForward()) wv.goForward();
});

btnReload.addEventListener("click", () => {
  getActiveWebview()?.reload();
});

const btnHome = document.getElementById("btn-home");
btnHome.addEventListener("click", async () => {
  const homeUrl = await window.orbit.homeUrl.get();
  if (isInternalUrl(homeUrl)) {
    const existing = tabs.find((t) => t.internalUrl === homeUrl);
    if (existing) {
      activateTab(existing.id);
      return;
    }
  }
  createTab(homeUrl);
});

newTabBtn.addEventListener("click", () => createTab());

// ── Agent panel ───────────────────────────────────

const btnAgent = document.getElementById("btn-agent");
const agentPanel = document.getElementById("agent-panel");
const agentPanelClose = document.getElementById("agent-panel-close");
const agentResizeHandle = document.getElementById("agent-resize-handle");
const agentPanelMessages = document.getElementById("agent-panel-messages");
const agentInput = document.getElementById("agent-input");
const agentSendBtn = document.getElementById("agent-send-btn");
const mainContent = document.getElementById("main-content");

let agentPanelWidth = 20;

function openAgentPanel() {
  agentPanel.classList.add("open");
  btnAgent.classList.add("active");
  mainContent.style.setProperty("--agent-panel-width", agentPanelWidth + "%");
}

function closeAgentPanel() {
  agentPanel.classList.remove("open");
  btnAgent.classList.remove("active");
}

function toggleAgentPanel() {
  const tab = getTab(activeTabId);
  if (tab?.internalUrl === SETTINGS_URL || tab?.internalUrl === HOME_URL) {
    closeAgentPanel();
    return;
  }
  if (agentPanel.classList.contains("open")) {
    closeAgentPanel();
  } else {
    openAgentPanel();
  }
}

btnAgent.addEventListener("click", toggleAgentPanel);
agentPanelClose.addEventListener("click", closeAgentPanel);

agentInput.addEventListener("input", () => {
  agentInput.style.height = "auto";
  agentInput.style.height = Math.min(agentInput.scrollHeight, 160) + "px";
  agentSendBtn.disabled = !agentInput.value.trim();
});

function addAgentMessage(role, text) {
  const welcome = agentPanelMessages.querySelector(".agent-welcome");
  if (welcome) welcome.remove();

  const msg = document.createElement("div");
  msg.className = "agent-msg " + role;
  const avatar = document.createElement("div");
  avatar.className = "agent-msg-avatar";
  avatar.textContent = role === "user" ? "Y" : "O";
  const body = document.createElement("div");
  body.className = "agent-msg-body";
  body.textContent = text;
  msg.appendChild(avatar);
  msg.appendChild(body);
  agentPanelMessages.appendChild(msg);
  agentPanelMessages.scrollTop = agentPanelMessages.scrollHeight;
}

agentSendBtn.addEventListener("click", () => {
  const text = agentInput.value.trim();
  if (!text) return;
  addAgentMessage("user", text);
  agentInput.value = "";
  agentInput.style.height = "auto";
  agentSendBtn.disabled = true;
});

agentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    agentSendBtn.click();
  }
});

agentResizeHandle.addEventListener("mousedown", (e) => {
  e.preventDefault();
  agentResizeHandle.classList.add("resizing");
  agentPanel.classList.add("resizing");
  mainContent.classList.add("resizing");
  const startX = e.clientX;
  const startWidth = agentPanel.offsetWidth;
  const contentWidth = mainContent.offsetWidth;

  function onMove(moveE) {
    const delta = startX - moveE.clientX;
    const newWidth = startWidth + delta;
    const pct = Math.round((newWidth / contentWidth) * 100);
    agentPanelWidth = Math.max(20, Math.min(60, pct));
    mainContent.style.setProperty("--agent-panel-width", agentPanelWidth + "%");
  }

  function onUp() {
    agentResizeHandle.classList.remove("resizing");
    agentPanel.classList.remove("resizing");
    mainContent.classList.remove("resizing");
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
});

// ── Dropdown menu ────────────────────────────────

const btnMenu = document.getElementById("btn-menu");
const dropdownMenu = document.getElementById("dropdown-menu");
const dropdownOverlay = document.getElementById("dropdown-overlay");
const menuAnchor = document.getElementById("menu-anchor");
const menuZoomIn = document.getElementById("menu-zoom-in");
const menuZoomOut = document.getElementById("menu-zoom-out");
const zoomLevelLabel = document.getElementById("zoom-level");

function closeDropdown() {
  dropdownMenu.classList.remove("open");
  dropdownOverlay.classList.remove("visible");
  menuAnchor.classList.remove("is-open");
}

btnMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle("open");
  dropdownOverlay.classList.toggle("visible", dropdownMenu.classList.contains("open"));
  menuAnchor.classList.toggle("is-open", dropdownMenu.classList.contains("open"));
  if (dropdownMenu.classList.contains("open")) updateZoomLabel();
});

dropdownOverlay.addEventListener("click", closeDropdown);

const menuNewTab = document.getElementById("menu-new-tab");
menuNewTab.addEventListener("click", () => {
  closeDropdown();
  createTab();
});

const menuNewWindow = document.getElementById("menu-new-window");
menuNewWindow.addEventListener("click", () => {
  closeDropdown();
  window.orbit.newWindow();
});

const menuSettings = document.getElementById("menu-settings");
menuSettings.addEventListener("click", () => {
  closeDropdown();
  const existing = tabs.find((t) => t.internalUrl === SETTINGS_URL);
  if (existing) {
    activateTab(existing.id);
  } else {
    createTab(SETTINGS_URL);
  }
});

// ── Zoom ─────────────────────────────────────────

const ZOOM_STEP = 0.5;
const ZOOM_MIN = -5;
const ZOOM_MAX = 5;

const ZOOM_PERCENTAGES = {
  "-5": 25, "-4.5": 30, "-4": 33, "-3.5": 40, "-3": 50,
  "-2.5": 60, "-2": 67, "-1.5": 75, "-1": 80, "-0.5": 90,
  "0": 100, "0.5": 110, "1": 125, "1.5": 150, "2": 175,
  "2.5": 200, "3": 250, "3.5": 275, "4": 300, "4.5": 350, "5": 400,
};

function updateZoomLabel() {
  const tab = getTab(activeTabId);
  const level = tab ? tab.zoomLevel : 0;
  const pct = ZOOM_PERCENTAGES[String(level)] || Math.round(Math.pow(1.2, level) * 100);
  zoomLevelLabel.textContent = pct + "%";
}

function zoomIn() {
  const tab = getTab(activeTabId);
  if (!tab || tab.internalUrl) return;
  tab.zoomLevel = Math.min(tab.zoomLevel + ZOOM_STEP, ZOOM_MAX);
  tab.view.setZoomLevel(tab.zoomLevel);
  updateZoomLabel();
}

function zoomOut() {
  const tab = getTab(activeTabId);
  if (!tab || tab.internalUrl) return;
  tab.zoomLevel = Math.max(tab.zoomLevel - ZOOM_STEP, ZOOM_MIN);
  tab.view.setZoomLevel(tab.zoomLevel);
  updateZoomLabel();
}

function zoomReset() {
  const tab = getTab(activeTabId);
  if (!tab || tab.internalUrl) return;
  tab.zoomLevel = 0;
  tab.view.setZoomLevel(0);
  updateZoomLabel();
}

menuZoomIn.addEventListener("click", zoomIn);
menuZoomOut.addEventListener("click", zoomOut);
zoomLevelLabel.addEventListener("click", zoomReset);

// ── Keyboard shortcuts ───────────────────────────

document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === "t") {
    e.preventDefault();
    createTab();
  }
  if (mod && e.key === "w") {
    e.preventDefault();
    if (activeTabId) closeTab(activeTabId);
  }
  if (mod && e.key === "l") {
    e.preventDefault();
    urlBar.focus();
    urlBar.select();
  }
  if (mod && (e.key === "=" || e.key === "+")) {
    e.preventDefault();
    zoomIn();
  }
  if (mod && e.key === "-") {
    e.preventDefault();
    zoomOut();
  }
  if (mod && e.key === "0") {
    e.preventDefault();
    zoomReset();
  }
});

// ── Boot ─────────────────────────────────────────

createTab();
