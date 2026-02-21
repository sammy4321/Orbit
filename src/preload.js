const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orbit", {
  platform: process.platform,
  closeWindow: () => ipcRenderer.send("window:close"),
  newWindow: () => ipcRenderer.send("window:new"),

  profile: {
    list: () => ipcRenderer.invoke("profile:list"),
    getCurrent: () => ipcRenderer.invoke("profile:getCurrent"),
    create: (name, fromGateway = false) => ipcRenderer.invoke("profile:create", name, fromGateway),
    switch: (id) => ipcRenderer.invoke("profile:switch", id),
    update: (id, name) => ipcRenderer.invoke("profile:update", id, name),
    updateColor: (id, color) => ipcRenderer.invoke("profile:updateColor", id, color),
    delete: (id) => ipcRenderer.invoke("profile:delete", id),
  },
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
  aiProvider: {
    get: () => ipcRenderer.invoke("aiProvider:get"),
    set: (value) => ipcRenderer.invoke("aiProvider:set", value),
  },
  geminiKey: {
    get: () => ipcRenderer.invoke("geminiKey:get"),
    set: (value) => ipcRenderer.invoke("geminiKey:set", value),
  },
  geminiModel: {
    get: () => ipcRenderer.invoke("geminiModel:get"),
    set: (value) => ipcRenderer.invoke("geminiModel:set", value),
  },
  tavilyKey: {
    get: () => ipcRenderer.invoke("tavilyKey:get"),
    set: (value) => ipcRenderer.invoke("tavilyKey:set", value),
  },
  homeUrl: {
    get: () => ipcRenderer.invoke("homeUrl:get"),
    set: (value) => ipcRenderer.invoke("homeUrl:set", value),
  },
  bookmark: {
    add: (url, title, folder) => ipcRenderer.invoke("bookmark:add", url, title, folder),
    remove: (id) => ipcRenderer.invoke("bookmark:remove", id),
    removeByUrl: (url) => ipcRenderer.invoke("bookmark:removeByUrl", url),
    list: (folder) => ipcRenderer.invoke("bookmark:list", folder),
    isBookmarked: (url) => ipcRenderer.invoke("bookmark:isBookmarked", url),
  },
  vault: {
    list: () => ipcRenderer.invoke("vault:list"),
    add: () => ipcRenderer.invoke("vault:add"),
    getFileContent: (id) => ipcRenderer.invoke("vault:getFileContent", id),
  },
  dialog: {
    openFiles: () => ipcRenderer.invoke("dialog:openFiles"),
  },
  agent: {
    chat: (messages) => ipcRenderer.invoke("agent:chat", messages),
  },
});
