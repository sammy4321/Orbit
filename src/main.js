const { app, BrowserWindow, ipcMain, dialog, protocol, net, nativeImage } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const profiles = require("./profiles");
const db = require("./db");
const agent = require("./agent");

let mainWindow = null;
const windowProfiles = new Map();

function createProfileGateway() {
  const iconPath = path.join(__dirname, "..", "assets", "orbit-logo.png");
  const win = new BrowserWindow({
    width: 500,
    height: 460,
    minWidth: 400,
    minHeight: 400,
    icon: iconPath,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadFile(path.join(__dirname, "profile-setup.html"));
  return win;
}

function createWindow(profileId) {
  const effectiveProfileId = profileId || profiles.getCurrent();
  const iconPath = path.join(__dirname, "..", "assets", "orbit-logo.png");
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
    },
  });

  windowProfiles.set(win.webContents.id, effectiveProfileId);
  win.webContents.on("did-finish-load", () => {
    if (!win.isDestroyed()) windowProfiles.set(win.webContents.id, effectiveProfileId);
  });
  win.on("closed", () => {
    windowProfiles.delete(win.webContents.id);
  });

  win.loadFile(path.join(__dirname, "index.html"));
  mainWindow = win;
  return win;
}

function ensureDbForSender(e) {
  const profileId = windowProfiles.get(e.sender.id) ?? profiles.getCurrent();
  if (profileId) db.switchProfile(profileId);
}

function setupIpc() {
  protocol.handle("orbit-vault", (request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.replace(/^\//, "").split("/").filter(Boolean);
      let profileId;
      let fileId;
      const looksLikeProfileId = url.hostname && /^[a-f0-9-]{36}$/i.test(url.hostname);
      if (pathParts.length >= 1 && looksLikeProfileId) {
        profileId = url.hostname;
        fileId = pathParts[0];
      } else {
        profileId = profiles.getCurrent();
        fileId = url.hostname || pathParts[0];
      }
      if (!profileId) return new Response("Not found", { status: 404 });
      db.switchProfile(profileId);
      const filePath = db.getVaultFilePath(parseInt(fileId, 10));
      if (!filePath) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response("Error", { status: 500 });
    }
  });

  ipcMain.handle("profile:list", () => {
    return profiles.list();
  });

  ipcMain.handle("profile:getCurrent", (e) => {
    const id = windowProfiles.get(e.sender.id) ?? profiles.getCurrent();
    if (!id) return null;
    const p = profiles.get(id);
    return p ? { id: p.id, name: p.name } : null;
  });

  ipcMain.handle("profile:create", (e, name, fromGateway = false) => {
    if (!name || !String(name).trim()) return { error: "Name is required" };
    const id = profiles.create(null, String(name).trim());
    if (fromGateway) {
      profiles.setCurrent(id);
      db.init(id);
      const gw = BrowserWindow.fromWebContents(e.sender);
      if (gw) gw.close();
      createWindow();
    }
    return { id };
  });

  ipcMain.handle("profile:switch", (e, profileId) => {
    const p = profiles.get(profileId);
    if (!p) return { error: "Profile not found" };
    profiles.setCurrent(profileId);
    createWindow(profileId);
    return { success: true };
  });

  ipcMain.handle("profile:update", (_e, id, name) => {
    if (!name || !String(name).trim()) return { error: "Name is required" };
    profiles.update(id, String(name).trim());
    return { success: true };
  });

  ipcMain.handle("profile:delete", (e, profileId) => {
    const list = profiles.list();
    if (list.length <= 1) return { error: "Cannot delete the only profile" };
    const next = list.find((p) => p.id !== profileId);
    if (!next) return { error: "Cannot delete the only profile" };
    profiles.setCurrent(next.id);
    for (const [wcId, pId] of windowProfiles.entries()) {
      if (pId === profileId) windowProfiles.set(wcId, next.id);
    }
    profiles.remove(profileId);
    const fs = require("fs");
    const profileDir = profiles.getProfileDir(profileId);
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true });
    }
    return { success: true };
  });

  ipcMain.handle("history:add", (e, url, title) => {
    ensureDbForSender(e);
    return db.addHistoryEntry(url, title);
  });

  ipcMain.handle("history:get", (e, limit, offset) => {
    ensureDbForSender(e);
    return db.getHistory(limit, offset);
  });

  ipcMain.handle("history:count", (e) => {
    ensureDbForSender(e);
    return db.getHistoryCount();
  });

  ipcMain.handle("history:search", (e, query, limit) => {
    ensureDbForSender(e);
    return db.searchHistory(query, limit);
  });

  ipcMain.handle("history:clear", (e) => {
    ensureDbForSender(e);
    return db.clearHistory();
  });

  ipcMain.handle("apiKey:get", (e) => {
    ensureDbForSender(e);
    return db.getApiKey();
  });

  ipcMain.handle("apiKey:set", (e, value) => {
    ensureDbForSender(e);
    return db.setApiKey(value);
  });

  ipcMain.handle("aiModel:get", (e) => {
    ensureDbForSender(e);
    return db.getAiModel();
  });

  ipcMain.handle("aiModel:set", (e, value) => {
    ensureDbForSender(e);
    return db.setAiModel(value);
  });

  ipcMain.handle("aiProvider:get", (e) => {
    ensureDbForSender(e);
    return db.getAiProvider();
  });

  ipcMain.handle("aiProvider:set", (e, value) => {
    ensureDbForSender(e);
    return db.setAiProvider(value);
  });

  ipcMain.handle("geminiKey:get", (e) => {
    ensureDbForSender(e);
    return db.getGeminiKey();
  });

  ipcMain.handle("geminiKey:set", (e, value) => {
    ensureDbForSender(e);
    return db.setGeminiKey(value);
  });

  ipcMain.handle("geminiModel:get", (e) => {
    ensureDbForSender(e);
    return db.getGeminiModel();
  });

  ipcMain.handle("geminiModel:set", (e, value) => {
    ensureDbForSender(e);
    return db.setGeminiModel(value);
  });

  ipcMain.handle("agent:chat", async (e, messages) => {
    ensureDbForSender(e);
    const provider = db.getAiProvider();
    const tavilyKey = db.getTavilyKey();
    if (provider === "gemini") {
      const apiKey = db.getGeminiKey();
      const model = db.getGeminiModel();
      return agent.chat(messages, apiKey, model, tavilyKey, "gemini");
    }
    const apiKey = db.getApiKey();
    const model = db.getAiModel();
    return agent.chat(messages, apiKey, model, tavilyKey, "openrouter");
  });

  ipcMain.handle("tavilyKey:get", (e) => {
    ensureDbForSender(e);
    return db.getTavilyKey();
  });

  ipcMain.handle("tavilyKey:set", (e, value) => {
    ensureDbForSender(e);
    return db.setTavilyKey(value);
  });

  ipcMain.handle("homeUrl:get", (e) => {
    ensureDbForSender(e);
    return db.getHomeUrl();
  });

  ipcMain.handle("homeUrl:set", (e, value) => {
    ensureDbForSender(e);
    return db.setHomeUrl(value);
  });

  ipcMain.handle("bookmark:add", (e, url, title, folder) => {
    ensureDbForSender(e);
    return db.addBookmark(url, title, folder);
  });

  ipcMain.handle("bookmark:remove", (e, id) => {
    ensureDbForSender(e);
    return db.removeBookmark(id);
  });

  ipcMain.handle("bookmark:removeByUrl", (e, url) => {
    ensureDbForSender(e);
    return db.removeBookmarkByUrl(url);
  });

  ipcMain.handle("bookmark:list", (e, folder) => {
    ensureDbForSender(e);
    return folder ? db.getBookmarks(folder) : db.getAllBookmarks();
  });

  ipcMain.handle("bookmark:isBookmarked", (e, url) => {
    ensureDbForSender(e);
    return db.isBookmarked(url);
  });

  ipcMain.handle("vault:list", (e) => {
    ensureDbForSender(e);
    return db.getVaultFiles();
  });

  ipcMain.handle("vault:add", async (e) => {
    ensureDbForSender(e);
    const result = await dialog.showOpenDialog({
      title: "Add PDFs to File Vault",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const added = [];
    for (const filePath of result.filePaths) {
      try {
        const file = db.addVaultFile(filePath);
        added.push(file);
      } catch (err) {
        console.error("Failed to add vault file:", filePath, err);
      }
    }
    return added;
  });

  ipcMain.handle("dialog:openFiles", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select files to attach",
      filters: [
        { name: "Images & PDFs", extensions: ["pdf", "png", "jpg", "jpeg", "gif", "webp"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile", "multiSelections"],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    const fs = require("fs");
    const files = [];
    for (const p of result.filePaths) {
      const ext = path.extname(p).toLowerCase();
      const mimeMap = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
      const mime = mimeMap[ext] || "application/octet-stream";
      const buf = fs.readFileSync(p);
      const b64 = buf.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      files.push({ name: path.basename(p), mimeType: mime, dataUrl });
    }
    return files;
  });

  ipcMain.handle("vault:getFileContent", (e, id) => {
    ensureDbForSender(e);
    const vaultFiles = db.getVaultFiles();
    const file = vaultFiles.find((f) => String(f.id) === String(id));
    if (!file) return null;
    const filePath = db.getVaultFilePath(parseInt(id, 10));
    if (!filePath) return null;
    const fs = require("fs");
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".pdf" ? "application/pdf" : `image/${ext.slice(1).replace("jpg", "jpeg")}`;
    const buf = fs.readFileSync(filePath);
    const b64 = buf.toString("base64");
    const dataUrl = `data:${mime};base64,${b64}`;
    return { name: file.original_name, mimeType: mime, dataUrl };
  });

  ipcMain.on("window:close", (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.close();
  });

  ipcMain.on("window:new", () => {
    createWindow();
  });
}

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, "..", "assets", "orbit-logo.png");
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath));
  }

  profiles.init();
  setupIpc();

  const profileList = profiles.list();
  const currentId = profiles.getCurrent();

  if (profileList.length === 0) {
    createProfileGateway();
  } else {
    const effectiveId = currentId && profileList.some((p) => p.id === currentId)
      ? currentId
      : profileList[0].id;
    if (effectiveId !== currentId) profiles.setCurrent(effectiveId);
    db.init(effectiveId);
    createWindow();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (profiles.list().length === 0) {
        createProfileGateway();
      } else {
        const current = profiles.getCurrent() || profiles.list()[0].id;
        profiles.setCurrent(current);
        db.init(current);
        createWindow();
      }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  db.close();
  profiles.close();
});
