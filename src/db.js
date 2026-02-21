const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const profiles = require("./profiles");

let db;
let currentProfileId;

function getVaultDir() {
  if (!currentProfileId) throw new Error("No profile selected");
  return profiles.getProfileVaultDir(currentProfileId);
}

function init(profileId) {
  if (!profileId) throw new Error("Profile ID required");
  if (db) db.close();
  currentProfileId = profileId;
  const dbPath = profiles.getProfileDbPath(profileId);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      url   TEXT    NOT NULL,
      title TEXT    DEFAULT '',
      visited_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_history_visited_at ON history(visited_at DESC)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vault (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name   TEXT    NOT NULL,
      stored_name     TEXT    NOT NULL,
      uploaded_at     DATETIME DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      url       TEXT    NOT NULL,
      title     TEXT    DEFAULT '',
      folder    TEXT    DEFAULT 'Bookmarks bar',
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url)`);

  getVaultDir();
  return db;
}

function switchProfile(profileId) {
  return init(profileId);
}

function getCurrentProfileId() {
  return currentProfileId;
}

function addHistoryEntry(url, title) {
  const stmt = db.prepare("INSERT INTO history (url, title) VALUES (?, ?)");
  return stmt.run(url, title || "");
}

function getHistory(limit = 100, offset = 0) {
  const stmt = db.prepare(
    "SELECT id, url, title, visited_at FROM history ORDER BY visited_at DESC LIMIT ? OFFSET ?"
  );
  return stmt.all(limit, offset);
}

function getHistoryCount() {
  const row = db.prepare("SELECT COUNT(*) as count FROM history").get();
  return row ? row.count : 0;
}

function searchHistory(query, limit = 50) {
  const stmt = db.prepare(
    "SELECT id, url, title, visited_at FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY visited_at DESC LIMIT ?"
  );
  const pattern = `%${query}%`;
  return stmt.all(pattern, pattern, limit);
}

function clearHistory() {
  db.exec("DELETE FROM history");
}

function getApiKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("ai_api_key");
  return row ? row.value : "";
}

function setApiKey(value) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  return stmt.run("ai_api_key", value || "");
}

function getAiModel() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("ai_model");
  return (row && row.value) ? row.value : "";
}

function setAiModel(value) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  return stmt.run("ai_model", value || "");
}

function getAiProvider() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("ai_provider");
  return (row && row.value) ? row.value : "openrouter";
}

function setAiProvider(value) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  return stmt.run("ai_provider", value || "openrouter");
}

function getGeminiKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("gemini_api_key");
  return row ? row.value : "";
}

function setGeminiKey(value) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  return stmt.run("gemini_api_key", value || "");
}

function getGeminiModel() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("gemini_model");
  return (row && row.value) ? row.value : "";
}

function setGeminiModel(value) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  return stmt.run("gemini_model", value || "");
}

function getTavilyKey() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("tavily_api_key");
  return row ? row.value : "";
}

function setTavilyKey(value) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  return stmt.run("tavily_api_key", value || "");
}

function getHomeUrl() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("home_url");
  return (row && row.value) ? row.value : "orbit://home";
}

function setHomeUrl(value) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  return stmt.run("home_url", value || "orbit://home");
}

function addVaultFile(originalPath) {
  const ext = path.extname(originalPath).toLowerCase();
  if (ext !== ".pdf") throw new Error("Only PDF files are supported");
  const storedName = randomUUID() + ext;
  const destPath = path.join(getVaultDir(), storedName);
  fs.copyFileSync(originalPath, destPath);
  const stmt = db.prepare("INSERT INTO vault (original_name, stored_name) VALUES (?, ?)");
  const result = stmt.run(path.basename(originalPath), storedName);
  return { id: result.lastInsertRowid, originalName: path.basename(originalPath), storedName };
}

function getVaultFiles() {
  return db.prepare(
    "SELECT id, original_name, stored_name, uploaded_at FROM vault ORDER BY uploaded_at DESC"
  ).all();
}

function getVaultFilePath(id) {
  const row = db.prepare("SELECT stored_name FROM vault WHERE id = ?").get(id);
  if (!row) return null;
  return path.join(getVaultDir(), row.stored_name);
}

function addBookmark(url, title, folder = "Bookmarks bar") {
  const existing = db.prepare("SELECT id FROM bookmarks WHERE url = ?").get(url);
  if (existing) return null;
  const stmt = db.prepare("INSERT INTO bookmarks (url, title, folder) VALUES (?, ?, ?)");
  const result = stmt.run(url, title || "", folder);
  return result.lastInsertRowid;
}

function removeBookmark(id) {
  const stmt = db.prepare("DELETE FROM bookmarks WHERE id = ?");
  return stmt.run(id);
}

function removeBookmarkByUrl(url) {
  const stmt = db.prepare("DELETE FROM bookmarks WHERE url = ?");
  return stmt.run(url);
}

function getBookmarks(folder = "Bookmarks bar") {
  return db.prepare(
    "SELECT id, url, title, folder, created_at FROM bookmarks WHERE folder = ? ORDER BY created_at DESC"
  ).all(folder);
}

function getAllBookmarks() {
  return db.prepare(
    "SELECT id, url, title, folder, created_at FROM bookmarks ORDER BY folder, created_at DESC"
  ).all();
}

function isBookmarked(url) {
  const row = db.prepare("SELECT id FROM bookmarks WHERE url = ?").get(url);
  return !!row;
}

function close() {
  if (db) db.close();
}

module.exports = {
  init,
  switchProfile,
  getCurrentProfileId,
  addHistoryEntry,
  getHistory,
  getHistoryCount,
  searchHistory,
  clearHistory,
  getApiKey,
  setApiKey,
  getAiModel,
  setAiModel,
  getAiProvider,
  setAiProvider,
  getGeminiKey,
  setGeminiKey,
  getGeminiModel,
  setGeminiModel,
  getTavilyKey,
  setTavilyKey,
  getHomeUrl,
  setHomeUrl,
  addVaultFile,
  getVaultFiles,
  getVaultFilePath,
  addBookmark,
  removeBookmark,
  removeBookmarkByUrl,
  getBookmarks,
  getAllBookmarks,
  isBookmarked,
  close,
};
