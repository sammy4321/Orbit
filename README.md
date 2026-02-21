<p align="center">
  <img src="assets/orbit-logo.png" alt="Orbit" width="128" height="128">
</p>

<h1 align="center">Orbit</h1>
<p align="center">
  <strong>A minimal, feature-rich browser built with Electron</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/electron-34-47848f" alt="Electron">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="Node">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

Orbit is a desktop browser focused on simplicity and modern web standards. Built on Electron and Chromium, it provides a clean interface for browsing with built-in tools for history, settings, AI assistance, and local file management.

## Features

| Feature | Description |
|---------|-------------|
| **Profiles** | Separate bookmarks, history, settings, and file vault per profile. Run multiple windows with different profiles simultaneously. |
| **Omnibox** | Chrome-style address bar with inline autocomplete, history suggestions, and Tab/Right arrow completion. |
| **Tab Management** | Native-style tabs with favicons and loading indicators. |
| **Home Page** | Custom `orbit://home` start page with quick navigation, search, and vault access. |
| **File Vault** | Local PDF storage per profile, accessible via `orbit-vault://`. |
| **History & Bookmarks** | Full browsing history with lazy-loading, plus a Bookmarks bar and manager. |
| **Agent Panel** | Integrated AI assistant side panel (OpenRouter / Gemini) with optional web search (Tavily). |
| **Dark Theme** | Low-contrast dark UI for comfortable viewing. |

## Requirements

- **Node.js** 18 or later  
- **npm** 9 or later  

## Installation

```bash
git clone https://github.com/sammy4321/Orbit.git
cd Orbit
make install
```

## Usage

```bash
make run
```

On first run, you'll be prompted to create a profile. Each profile has its own bookmarks, history, settings, and file vault.

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

## Tech Stack

- [Electron](https://www.electronjs.org/) — Cross-platform desktop app framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Embedded SQLite for history, settings, bookmarks, vault
- [LangChain](https://js.langchain.com/) — AI integrations (OpenRouter, Google Gemini)
- [marked](https://marked.js.org/) — Markdown rendering in chat
- Chromium — Web rendering engine

## License

Licensed under the [Apache License 2.0](LICENSE).

## Topics

`electron` `browser` `chromium` `desktop-app` `profiles` `sqlite` `ai-assistant` `bookmarks`

---

<p align="center">
  <sub>Built with Electron • Powered by Chromium</sub>
</p>
