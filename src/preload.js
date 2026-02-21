const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orbit", {
  platform: process.platform,
  closeWindow: () => ipcRenderer.send("window:close"),
  newWindow: () => ipcRenderer.send("window:new"),

  history: {
    add: (url, title) => ipcRenderer.invoke("history:add", url, title),
    get: (limit, offset) => ipcRenderer.invoke("history:get", limit, offset),
    count: () => ipcRenderer.invoke("history:count"),
    search: (query, limit) => ipcRenderer.invoke("history:search", query, limit),
    clear: () => ipcRenderer.invoke("history:clear"),
  },
  apiKey: {
    get: () => ipcRenderer.invoke("apiKey:get"),
    set: (value) => ipcRenderer.invoke("apiKey:set", value),
  },
  aiModel: {
    get: () => ipcRenderer.invoke("aiModel:get"),
    set: (value) => ipcRenderer.invoke("aiModel:set", value),
  },
  homeUrl: {
    get: () => ipcRenderer.invoke("homeUrl:get"),
    set: (value) => ipcRenderer.invoke("homeUrl:set", value),
  },
  vault: {
    list: () => ipcRenderer.invoke("vault:list"),
    add: () => ipcRenderer.invoke("vault:add"),
  },
});
