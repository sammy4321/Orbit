<p align="center">
  <img src="assets/orbit-logo.png" alt="Orbit" width="128" height="128">
</p>

# Orbit

**A minimal, feature-rich browser built with Electron.**

Orbit is a desktop browser focused on simplicity and modern web standards. Built on Electron and Chromium, it provides a clean interface for browsing, with built-in tools for history, settings, AI assistance, and local file management.

---

## Features

- **Profiles** — Separate bookmarks, history, settings, and file vault per profile. Switch between profiles or run multiple windows with different profiles at once.
- **Omnibox** — Chrome-style address bar with inline autocomplete, history suggestions, and Tab/Right arrow to accept completion.
- **Tab Management** — Native-style tabs with favicons and loading indicators.
- **orbit://home** — Custom start page with quick navigation, search, and vault access.
- **File Vault** — Local storage for PDFs, accessible via `orbit-vault://`. Each profile has its own vault.
- **History** — Full browsing history with lazy-loading infinite scroll.
- **Bookmarks** — Save and organize bookmarks in the Bookmarks bar and Settings.
- **Settings** — Configurable home page, AI API settings (OpenRouter / Gemini), and file vault.
- **Agent Panel** — Integrated AI assistant side panel with optional web search (Tavily).
- **Dark Theme** — Low-contrast dark UI for comfortable viewing.

---

## Requirements

- **Node.js** 18+
- **npm** 9+

---

## Installation

```bash
git clone https://github.com/sammy4321/Orbit.git
cd Orbit
make install
```

---

## Usage

```bash
make run
```

On first run, you’ll be prompted to create a profile. Each profile has its own bookmarks, history, settings, and file vault.

---

## Project Structure

```
Orbit/
├── src/
│   ├── main.js           # Electron main process, IPC handlers
│   ├── preload.js        # Context bridge (orbit API)
│   ├── renderer.js       # UI logic, tabs, omnibox, settings, agent panel
│   ├── index.html        # App shell & styles
│   ├── profile-setup.html # First-run profile creation
│   ├── db.js             # SQLite (per-profile history, settings, vault)
│   ├── profiles.js       # Profile metadata & storage paths
│   └── agent.js          # AI chat (OpenRouter, Gemini)
├── assets/
│   └── orbit-logo.png
├── Makefile
├── package.json
└── README.md
```

---

## Tech Stack

- [Electron](https://www.electronjs.org/) — Cross-platform desktop app framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Embedded SQLite for history, settings, bookmarks, and vault metadata
- [LangChain](https://js.langchain.com/) — AI integrations (OpenRouter, Google Gemini)
- [marked](https://marked.js.org/) — Markdown rendering in chat
- Chromium — Web rendering engine

---

## License

Apache 2.0
