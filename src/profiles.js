const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { randomUUID, randomInt } = require("crypto");

const PROFILE_COLORS = [
  "#5b8def", "#e85d75", "#6bdb7a", "#f0b429", "#b388ff",
  "#42a5f5", "#ef5350", "#66bb6a", "#ffa726", "#ab47bc",
];

let metaDb;
let profilesDir;

function getProfilesMetaPath() {
  return path.join(app.getPath("userData"), "profiles-meta.db");
}

function getProfilesDir() {
  if (!profilesDir) {
    profilesDir = path.join(app.getPath("userData"), "profiles");
    if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });
  }
  return profilesDir;
}

function getProfileDir(profileId) {
  const dir = path.join(getProfilesDir(), profileId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getProfileDbPath(profileId) {
  return path.join(getProfileDir(profileId), "orbit.db");
}

function getProfileVaultDir(profileId) {
  const dir = path.join(getProfileDir(profileId), "vault");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getLegacyDbPath() {
  return path.join(app.getPath("userData"), "orbit.db");
}

function getLegacyVaultDir() {
  return path.join(app.getPath("userData"), "orbit-vault");
}

function init() {
  metaDb = new Database(getProfilesMetaPath());
  metaDb.pragma("journal_mode = WAL");

  metaDb.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  const columns = metaDb.prepare("PRAGMA table_info(profiles)").all().map((c) => c.name);
  if (!columns.includes("color")) metaDb.exec("ALTER TABLE profiles ADD COLUMN color TEXT");

  metaDb.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  getProfilesDir();

  migrateLegacyIfNeeded();
  migrateProfileAvatars();
}

function migrateProfileAvatars() {
  const rows = metaDb.prepare("SELECT id FROM profiles WHERE color IS NULL").all();
  for (const row of rows) {
    const color = PROFILE_COLORS[randomInt(0, PROFILE_COLORS.length)];
    metaDb.prepare("UPDATE profiles SET color = ? WHERE id = ?").run(color, row.id);
  }
}

function migrateLegacyIfNeeded() {
  const legacyDb = getLegacyDbPath();
  const legacyVault = getLegacyVaultDir();
  const profiles = list();
  const hasLegacyDb = fs.existsSync(legacyDb);
  const hasLegacyVault = fs.existsSync(legacyVault);

  if (profiles.length === 0 && (hasLegacyDb || hasLegacyVault)) {
    const defaultId = randomUUID();
    create(defaultId, "Default");
    setCurrent(defaultId);
    const profileDir = getProfileDir(defaultId);
    if (hasLegacyDb) {
      fs.copyFileSync(legacyDb, path.join(profileDir, "orbit.db"));
    }
    if (hasLegacyVault && fs.existsSync(legacyVault)) {
      const targetVault = path.join(profileDir, "vault");
      if (!fs.existsSync(targetVault)) fs.mkdirSync(targetVault, { recursive: true });
      const files = fs.readdirSync(legacyVault);
      for (const f of files) {
        const src = path.join(legacyVault, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(targetVault, f));
        }
      }
    }
  }
}

function list() {
  return metaDb.prepare(
    "SELECT id, name, color, created_at FROM profiles ORDER BY created_at ASC"
  ).all();
}

function create(id, name) {
  const finalId = id || randomUUID();
  const color = PROFILE_COLORS[randomInt(0, PROFILE_COLORS.length)];
  const stmt = metaDb.prepare(
    "INSERT INTO profiles (id, name, color) VALUES (?, ?, ?)"
  );
  stmt.run(finalId, name || "New Profile", color);
  return finalId;
}

function get(id) {
  return metaDb.prepare(
    "SELECT id, name, color, created_at FROM profiles WHERE id = ?"
  ).get(id);
}

function update(id, name) {
  const stmt = metaDb.prepare("UPDATE profiles SET name = ? WHERE id = ?");
  return stmt.run(name, id);
}

function updateColor(id, color) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
  const stmt = metaDb.prepare("UPDATE profiles SET color = ? WHERE id = ?");
  return stmt.run(color, id);
}

function remove(id) {
  const stmt = metaDb.prepare("DELETE FROM profiles WHERE id = ?");
  return stmt.run(id);
}

function getCurrent() {
  const row = metaDb.prepare(
    "SELECT value FROM meta WHERE key = ?"
  ).get("current_profile");
  return row ? row.value : null;
}

function setCurrent(profileId) {
  const stmt = metaDb.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  return stmt.run("current_profile", profileId);
}

function close() {
  if (metaDb) metaDb.close();
}

module.exports = {
  init,
  list,
  create,
  get,
  update,
  updateColor,
  remove,
  getCurrent,
  setCurrent,
  getProfileDir,
  getProfileDbPath,
  getProfileVaultDir,
  getProfilesDir,
  close,
};
