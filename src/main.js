const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const db = require("./db");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  db.init();

  protocol.handle("orbit-vault", (request) => {
    try {
      const id = new URL(request.url).hostname;
      const filePath = db.getVaultFilePath(parseInt(id, 10));
      if (!filePath) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response("Error", { status: 500 });
    }
  });

  ipcMain.handle("history:add", (_e, url, title) => {
    return db.addHistoryEntry(url, title);
  });

  ipcMain.handle("history:get", (_e, limit, offset) => {
    return db.getHistory(limit, offset);
  });

  ipcMain.handle("history:count", () => {
    return db.getHistoryCount();
  });

  ipcMain.handle("history:search", (_e, query, limit) => {
    return db.searchHistory(query, limit);
  });

  ipcMain.handle("history:clear", () => {
    return db.clearHistory();
  });

  ipcMain.handle("apiKey:get", () => {
    return db.getApiKey();
  });

  ipcMain.handle("apiKey:set", (_e, value) => {
    return db.setApiKey(value);
  });

  ipcMain.handle("aiModel:get", () => {
    return db.getAiModel();
  });

  ipcMain.handle("aiModel:set", (_e, value) => {
    return db.setAiModel(value);
  });

  ipcMain.handle("homeUrl:get", () => {
    return db.getHomeUrl();
  });

  ipcMain.handle("homeUrl:set", (_e, value) => {
    return db.setHomeUrl(value);
  });

  ipcMain.handle("vault:list", () => {
    return db.getVaultFiles();
  });

  ipcMain.handle("vault:add", async () => {
    const result = await dialog.showOpenDialog({
      title: "Add PDF to File Vault",
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return db.addVaultFile(result.filePaths[0]);
  });

  ipcMain.on("window:close", (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.close();
  });

  ipcMain.on("window:new", () => {
    createWindow();
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  db.close();
});
