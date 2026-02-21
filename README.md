<p align="center">
  <img src="assets/orbit-logo.png" alt="Orbit" width="128" height="128">
</p>

# Orbit

**A minimal, feature-rich browser built with Electron.**

Orbit is a desktop browser focused on simplicity and modern web standards. Built on Electron and Chromium, it provides a clean interface for browsing, with built-in tools for history, settings, and local file management.

---

## Features

- **Omnibox** — Chrome-style address bar with inline autocomplete, history suggestions, and Tab/Right arrow to accept completion
- **Tab Management** — Native-style tabs with favicons and loading indicators
- **orbit://home** — Custom start page with quick navigation and search
- **File Vault** — Secure local storage for PDFs and documents, accessible via `orbit-vault://`
- **History** — Full browsing history with lazy-loading infinite scroll
- **Settings** — Configurable home page, AI API settings, and more
- **Agent Panel** — Integrated AI assistant side panel (optional)
- **Dark Theme** — Low-contrast dark UI for comfortable viewing

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

## Usage

```bash
make run
```

---

## Project Structure

```
Orbit/
├── src/
│   ├── main.js       # Electron main process
│   ├── preload.js    # Context bridge (orbit API)
│   ├── renderer.js   # UI logic, tabs, omnibox, settings
│   ├── db.js         # SQLite (history, settings, vault)
│   └── index.html    # App shell & styles
├── assets/
│   └── orbit-logo.png
├── Makefile
├── package.json
└── README.md
```

---

## Tech Stack

- [Electron](https://www.electronjs.org/) — Cross-platform desktop app framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Embedded SQLite for history and settings
- Chromium — Web rendering engine

---

## License

MIT
