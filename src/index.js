/**
 * ATLAS MCP Server
 * AI Transport Logistics Agent Standard — MCP server entry point
 */
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Atlas } from "./atlas.js";

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const atlas = new Atlas();

try {
  atlas.loadConfig(process.env.ATLAS_CONFIG);
} catch (err) {
  console.error(`[ATLAS] Config warning: ${err.message} — using defaults`);
}

try {
  atlas.initDb(process.env.ATLAS_DB_PATH ?? ":memory:");
} catch (err) {
  console.error(`[ATLAS] DB init error: ${err.message}`);
  process.exit(1);
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "atlas",
  version: "0.1.0",
});

// ─── Tool: query ─────────────────────────────────────────────────────────────

server.tool(
  "query",
  "Search across all logistics data (shipments, carriers, routes) using natural language",
  {
    question: z.string().describe("Natural language question about logistics data"),
    mode: z
      .enum(["road", "ocean", "air", "rail", "multimodal"])
      .optional()
      .describe("Filter by transport mode"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe("Max results to return"),
  },
  async ({ question, mode, limit }) => {
    try {
      const { results, context } = atlas.query(question, { mode, limit });
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} result(s) for: "${question}"\n\n${context}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Query error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: get_shipment ───────────────────────────────────────────────────────

server.tool(
  "get_shipment",
  "Retrieve full details for a specific shipment by ID",
  {
    id: z.string().describe("Shipment ID"),
  },
  async ({ id }) => {
    try {
      const shipment = atlas.getShipment(id);
      if (!shipment) {
        return {
          content: [{ type: "text", text: `Shipment not found: ${id}` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(shipment, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: search_carriers ────────────────────────────────────────────────────

server.tool(
  "search_carriers",
  "Search and filter carriers by country, type, or minimum rating",
  {
    country: z
      .string()
      .length(2)
      .optional()
      .describe("ISO 3166-1 alpha-2 country code (e.g. US, DE, NL)"),
    type: z
      .enum(["trucking", "shipping_line", "airline", "rail", "broker"])
      .optional()
      .describe("Carrier type"),
    min_rating: z
      .number()
      .min(0)
      .max(5)
      .optional()
      .describe("Minimum carrier rating (0–5)"),
    limit: z.number().int().min(1).max(100).optional().default(20),
  },
  async ({ country, type, min_rating, limit }) => {
    try {
      const carriers = atlas.searchCarriers({ country, type, min_rating, limit });
      if (carriers.length === 0) {
        return {
          content: [{ type: "text", text: "No carriers found matching criteria." }],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Found ${carriers.length} carrier(s):\n\n${JSON.stringify(carriers, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: get_rate_history ───────────────────────────────────────────────────

server.tool(
  "get_rate_history",
  "Retrieve freight rate history for a lane (origin → destination)",
  {
    origin: z
      .string()
      .length(2)
      .describe("Origin country code (ISO 3166-1 alpha-2, e.g. US)"),
    destination: z
      .string()
      .length(2)
      .describe("Destination country code (ISO 3166-1 alpha-2, e.g. DE)"),
    mode: z
      .enum(["road", "ocean", "air", "rail", "multimodal"])
      .optional()
      .describe("Transport mode filter"),
    days: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .default(90)
      .describe("Look back N days"),
  },
  async ({ origin, destination, mode, days }) => {
    try {
      const rates = atlas.getRateHistory({ origin, destination, mode, days });
      if (rates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No rates found for ${origin} → ${destination} in the last ${days} days.`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Found ${rates.length} rate record(s) for ${origin} → ${destination}:\n\n${JSON.stringify(rates, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Tool: list_documents ─────────────────────────────────────────────────────

server.tool(
  "list_documents",
  "List logistics documents, optionally filtered by shipment ID or document type",
  {
    shipment_id: z
      .string()
      .optional()
      .describe("Filter documents by shipment ID"),
    type: z
      .enum([
        "bol",
        "cmr",
        "awb",
        "invoice",
        "customs_export",
        "customs_import",
        "pod",
        "packing_list",
        "certificate_of_origin",
        "dangerous_goods",
        "other",
      ])
      .optional()
      .describe("Document type filter"),
    limit: z.number().int().min(1).max(200).optional().default(50),
  },
  async ({ shipment_id, type, limit }) => {
    try {
      const docs = atlas.listDocuments({ shipment_id, type, limit });
      if (docs.length === 0) {
        return {
          content: [{ type: "text", text: "No documents found." }],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Found ${docs.length} document(s):\n\n${JSON.stringify(docs, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[ATLAS] MCP server running on stdio");
