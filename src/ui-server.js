/**
 * ATLAS Web UI Server
 * HTTP server serving the admin dashboard on port 3000
 * Run: node src/ui-server.js
 * Runs alongside MCP stdio in the same process when using docker
 */
import http from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Atlas } from "./atlas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function startWebUI(atlas, port = 3000) {
  const uiPath = join(__dirname, "ui", "index.html");

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    // CORS for local dev
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204); res.end(); return;
    }

    // ── Serve UI ──────────────────────────────────────────────────────────
    if (path === "/" || path === "/ui") {
      try {
        const html = readFileSync(uiPath, "utf8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch {
        res.writeHead(500); res.end("UI file not found");
      }
      return;
    }

    // ── API ───────────────────────────────────────────────────────────────
    if (!path.startsWith("/api/")) {
      res.writeHead(404); res.end("Not found"); return;
    }

    res.setHeader("Content-Type", "application/json");

    try {
      // GET /api/status
      if (path === "/api/status" && req.method === "GET") {
        const db = atlas.db;
        const counts = {};
        if (db) {
          ["shipments", "carriers", "routes", "rates", "documents", "events"].forEach((t) => {
            try { counts[t] = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get()?.n ?? 0; }
            catch { counts[t] = 0; }
          });
        }
        res.end(JSON.stringify({ status: "running", uptime: Math.floor(process.uptime()), counts }));
        return;
      }

      // GET /api/connectors
      if (path === "/api/connectors" && req.method === "GET") {
        const cfg = atlas.config?.connectors ?? {};
        const connectors = Object.entries(cfg).map(([name, conf]) => ({
          name, enabled: conf?.enabled ?? false,
          type: conf?.type ?? name,
        }));
        res.end(JSON.stringify({ connectors }));
        return;
      }

      // GET /api/data/:table?limit=50&search=
      if (path.startsWith("/api/data/") && req.method === "GET") {
        const table = path.replace("/api/data/", "").replace(/[^a-z_]/g, "");
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
        const search = url.searchParams.get("search") ?? "";
        const allowed = ["shipments", "carriers", "routes", "rates", "documents", "events"];
        if (!allowed.includes(table)) {
          res.writeHead(400); res.end(JSON.stringify({ error: "Invalid table" })); return;
        }
        const rows = atlas.db
          .prepare(`SELECT data FROM ${table} LIMIT ?`)
          .all(limit)
          .map((r) => JSON.parse(r.data));

        const filtered = search
          ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
          : rows;

        res.end(JSON.stringify({ table, rows: filtered, total: filtered.length }));
        return;
      }

      // POST /api/query
      if (path === "/api/query" && req.method === "POST") {
        const body = await readBody(req);
        const { tool, params } = JSON.parse(body);

        let result;
        if (tool === "query") {
          result = atlas.query(params.question, { mode: params.mode, limit: params.limit ?? 10 });
        } else if (tool === "get_shipment") {
          result = atlas.getShipment(params.id);
        } else if (tool === "search_carriers") {
          result = atlas.searchCarriers(params);
        } else if (tool === "get_rate_history") {
          result = atlas.getRateHistory(params);
        } else if (tool === "list_documents") {
          result = atlas.listDocuments(params);
        } else {
          res.writeHead(400); res.end(JSON.stringify({ error: `Unknown tool: ${tool}` })); return;
        }

        res.end(JSON.stringify({ ok: true, result }));
        return;
      }

      res.writeHead(404); res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(port, () => {
    console.error(`[ATLAS] Web UI running at http://localhost:${port}`);
  });

  return server;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// ── Standalone entry ──────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const atlas = new Atlas();
  try { atlas.loadConfig(process.env.ATLAS_CONFIG); } catch {}
  atlas.initDb(process.env.ATLAS_DB_PATH ?? ":memory:");
  startWebUI(atlas, parseInt(process.env.ATLAS_PORT ?? "3000"));
}
