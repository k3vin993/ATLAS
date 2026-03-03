/**
 * ATLAS Core
 * Central class managing config, SQLite storage, and query logic
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Atlas {
  constructor() {
    this.config = null;
    this.db = null;
  }

  // ─── Config ──────────────────────────────────────────────────────────────

  loadConfig(configPath) {
    const resolved = configPath
      ? configPath
      : join(__dirname, "..", "config.yml");

    const fallback = join(__dirname, "..", "config.example.yml");
    const target = existsSync(resolved) ? resolved : fallback;

    if (!existsSync(target)) {
      throw new Error(`Config not found: ${resolved}`);
    }

    const raw = readFileSync(target, "utf8");
    this.config = YAML.parse(raw);
    return this.config;
  }

  // ─── SQLite ───────────────────────────────────────────────────────────────

  initDb(dbPath) {
    const path = dbPath || (this.config?.storage?.path ?? "/data/atlas/atlas.db");
    this.db = new Database(path);
    this._initSchema();
    return this.db;
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shipments (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS carriers (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS routes (
        id TEXT PRIMARY KEY,
        data JSON NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS rates (
        id TEXT PRIMARY KEY,
        carrier_id TEXT,
        origin_country TEXT,
        destination_country TEXT,
        mode TEXT,
        valid_from TEXT,
        valid_to TEXT,
        data JSON NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        shipment_id TEXT,
        type TEXT,
        data JSON NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        shipment_id TEXT,
        timestamp TEXT,
        type TEXT,
        is_exception INTEGER DEFAULT 0,
        data JSON NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rates_carrier ON rates(carrier_id);
      CREATE INDEX IF NOT EXISTS idx_rates_lane ON rates(origin_country, destination_country);
      CREATE INDEX IF NOT EXISTS idx_documents_shipment ON documents(shipment_id);
      CREATE INDEX IF NOT EXISTS idx_events_shipment ON events(shipment_id);
    `);
  }

  // ─── Shipments ────────────────────────────────────────────────────────────

  getShipment(id) {
    if (!this.db) return null;
    const row = this.db.prepare("SELECT data FROM shipments WHERE id = ?").get(id);
    return row ? JSON.parse(row.data) : null;
  }

  upsertShipment(shipment) {
    if (!this.db) throw new Error("DB not initialized");
    this.db
      .prepare("INSERT OR REPLACE INTO shipments (id, data) VALUES (?, ?)")
      .run(shipment.id, JSON.stringify(shipment));
    return shipment;
  }

  listShipments({ status, mode, limit = 20 } = {}) {
    if (!this.db) return [];
    let sql = "SELECT data FROM shipments";
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push("json_extract(data,'$.status') = ?");
      params.push(status);
    }
    if (mode) {
      conditions.push("json_extract(data,'$.mode') = ?");
      params.push(mode);
    }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += ` LIMIT ?`;
    params.push(limit);

    return this.db.prepare(sql).all(...params).map((r) => JSON.parse(r.data));
  }

  // ─── Carriers ─────────────────────────────────────────────────────────────

  getCarrier(id) {
    if (!this.db) return null;
    const row = this.db.prepare("SELECT data FROM carriers WHERE id = ?").get(id);
    return row ? JSON.parse(row.data) : null;
  }

  searchCarriers({ country, type, min_rating, limit = 20 } = {}) {
    if (!this.db) return [];
    let sql = "SELECT data FROM carriers";
    const params = [];
    const conditions = [];

    if (country) {
      conditions.push("json_extract(data,'$.country') = ?");
      params.push(country.toUpperCase());
    }
    if (type) {
      conditions.push("json_extract(data,'$.type') = ?");
      params.push(type);
    }
    if (min_rating != null) {
      conditions.push("json_extract(data,'$.rating') >= ?");
      params.push(min_rating);
    }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " LIMIT ?";
    params.push(limit);

    return this.db.prepare(sql).all(...params).map((r) => JSON.parse(r.data));
  }

  // ─── Routes ───────────────────────────────────────────────────────────────

  getRoute(origin, destination, mode) {
    if (!this.db) return null;
    let sql = `
      SELECT data FROM routes
      WHERE json_extract(data,'$.origin.country') = ?
        AND json_extract(data,'$.destination.country') = ?
    `;
    const params = [origin.toUpperCase(), destination.toUpperCase()];
    if (mode) {
      sql += " AND json_extract(data,'$.mode') = ?";
      params.push(mode);
    }
    sql += " LIMIT 1";
    const row = this.db.prepare(sql).get(...params);
    return row ? JSON.parse(row.data) : null;
  }

  // ─── Rates ────────────────────────────────────────────────────────────────

  getRateHistory({ origin, destination, mode, days = 90, limit = 50 } = {}) {
    if (!this.db) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    let sql = `
      SELECT data FROM rates
      WHERE origin_country = ?
        AND destination_country = ?
        AND (valid_to IS NULL OR valid_to >= ?)
    `;
    const params = [
      origin.toUpperCase(),
      destination.toUpperCase(),
      cutoffStr,
    ];

    if (mode) {
      sql += " AND mode = ?";
      params.push(mode);
    }
    sql += " ORDER BY valid_from DESC LIMIT ?";
    params.push(limit);

    return this.db.prepare(sql).all(...params).map((r) => JSON.parse(r.data));
  }

  // ─── Documents ────────────────────────────────────────────────────────────

  listDocuments({ shipment_id, type, limit = 50 } = {}) {
    if (!this.db) return [];
    let sql = "SELECT data FROM documents";
    const params = [];
    const conditions = [];

    if (shipment_id) {
      conditions.push("shipment_id = ?");
      params.push(shipment_id);
    }
    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    return this.db.prepare(sql).all(...params).map((r) => JSON.parse(r.data));
  }

  // ─── Query (keyword search) ───────────────────────────────────────────────

  query(question, { mode, limit = 10 } = {}) {
    if (!this.db) return { results: [], context: "Database not initialized." };

    const tokens = question
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (tokens.length === 0) {
      return { results: [], context: "No query terms provided." };
    }

    const results = [];

    // Search shipments
    const shipments = this.db
      .prepare("SELECT data FROM shipments LIMIT 500")
      .all()
      .map((r) => JSON.parse(r.data));

    for (const s of shipments) {
      const text = JSON.stringify(s).toLowerCase();
      const score = tokens.filter((t) => text.includes(t)).length;
      if (score > 0) results.push({ type: "shipment", score, data: s });
    }

    // Search carriers
    const carriers = this.db
      .prepare("SELECT data FROM carriers LIMIT 500")
      .all()
      .map((r) => JSON.parse(r.data));

    for (const c of carriers) {
      const text = JSON.stringify(c).toLowerCase();
      const score = tokens.filter((t) => text.includes(t)).length;
      if (score > 0) results.push({ type: "carrier", score, data: c });
    }

    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, limit);

    const context = top.length
      ? top.map((r) => `[${r.type}] ${JSON.stringify(r.data)}`).join("\n\n")
      : "No matching records found.";

    return { results: top, context };
  }
}

export default Atlas;
