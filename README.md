# ATLAS — AI Transport Logistics Agent Standard

**The open-source MCP server that gives AI agents deep context about your logistics operations — without your data ever leaving your infrastructure.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)

---

## The Problem

Enterprise logistics companies have years of operational data — emails, contracts, TMS records, carrier relationships, pricing history. AI agents need this context to be useful. But sharing raw data with external cloud services is a non-starter for compliance, legal, and security teams.

The result: AI stays shallow. Agents can't negotiate from context. Every interaction starts from zero.

## The Solution

ATLAS runs **inside your security perimeter**. It connects to your existing systems, indexes your data locally, and exposes a standardized MCP interface. Any AI agent can query ATLAS — getting deep operational context — without your data ever leaving your infrastructure.

```
[Your Company]                        [Cargofy / Any AI Agent]
  ├── Email                                      │
  ├── TMS                    MCP Protocol        │
  ├── ERP          ←─────────────────────────────┤
  ├── Contracts              (questions only,    │
  ├── Knowledge Base          no raw data out)   │
  └── ATLAS instance ────────────────────────────┘
```

Your data stays with you. Agents get the context they need.

---

## Quick Start

**Option 1: Docker (recommended)**

```bash
docker run -d \
  -v ./config.yml:/app/config.yml \
  -v atlas_data:/data/atlas \
  cargofy/atlas:latest
```

**Option 2: Claude Desktop**

Add to your `claude_desktop_config.json` under `mcpServers`:

```json
{
  "atlas": {
    "command": "docker",
    "args": ["run", "--rm", "-i", "-v", "/your/data:/data", "cargofy/atlas:latest"]
  }
}
```

**Option 3: Run from source**

```bash
git clone https://github.com/cargofy/ATLAS
cd ATLAS
npm install
node seed.js          # optional: load sample data
node src/index.js     # starts MCP server on stdio
```

Configure your data sources in `config.yml` (copy from `config.example.yml`).

---

## Connectors

| Connector | Status | Description |
|-----------|--------|-------------|
| Email (IMAP/Exchange) | 🔜 v0.2 | Indexes all logistics-related emails |
| Filesystem (JSON, CSV, PDF) | ✅ Available | Local contracts, BOLs, rate sheets |
| REST API | ✅ Available | Connect any TMS or ERP via API |
| SAP TM | 🔜 Coming soon | Native SAP Transportation Management |
| Oracle TMS | 🔜 Coming soon | Oracle Transportation Management |
| Transporeon | 🔜 Coming soon | Transporeon platform integration |
| project44 | 🔜 Coming soon | Visibility and tracking data |

---

## Data Models

ATLAS ships with logistics-native data models covering all transport modes:

- **Shipment** — ocean, air, road, rail, multimodal
- **Carrier** — profiles, performance history, rates
- **Route** — lanes, corridors, transit times
- **Document** — BOL, CMR, AWB, customs declarations
- **Rate** — historical pricing, spot vs contract
- **Event** — pickup, transit, delivery, exception

These models are the foundation. Agents query against them — not raw data.

---

## MCP Interface

ATLAS exposes a standard [Model Context Protocol](https://modelcontextprotocol.io) server. Any MCP-compatible agent can connect:

```python
# Any AI agent connecting to ATLAS
client = MCPClient("http://atlas.yourcompany.internal:3000")

# Ask for context — data never leaves your perimeter
context = client.query("best carrier for Warsaw–Hamburg lane, last 6 months")
# → Returns structured insights from your own data
```

---

## Architecture

```
ATLAS Instance (your infrastructure)
├── Ingestion Layer
│   ├── Email connector
│   ├── Document connector
│   └── TMS/ERP connectors
├── Processing Layer
│   ├── Logistics entity extraction
│   ├── Vector embeddings (local)
│   └── Structured data models
├── Storage Layer
│   ├── Vector store (local)
│   └── Relational index (SQLite/PostgreSQL)
└── MCP Server
    ├── Query interface
    ├── Context retrieval
    └── Agent authentication
```

---

## Use Cases

**Carrier Negotiation Agent**
> Agent queries ATLAS: "What's our volume with DHL on DE→PL in Q4?" → Gets answer from your own data → Negotiates from a position of knowledge.

**Customer Service Agent**
> "Where is shipment #12345?" → Agent queries ATLAS for shipment status from your TMS → Answers instantly without manual lookup.

**Procurement Agent**
> "Who are the top 3 carriers for refrigerated transport to Ukraine?" → Agent pulls from your historical performance data in ATLAS → Makes data-driven recommendation.

---

## Security & Privacy

- **Zero data egress** — ATLAS never sends your raw data outside your network
- **Local embeddings** — all vector processing happens on your infrastructure
- **Agent authentication** — control which agents can query your ATLAS instance
- **Audit logs** — full log of every query made to your instance
- **Open source** — inspect every line of code

---

## Powered by Cargofy

ATLAS is built and maintained by [Cargofy](https://cargofy.com) — the AI platform for logistics. We built ATLAS because our enterprise customers needed it. We open-sourced it because the logistics industry needs a standard.

**Cargofy platform** connects to your ATLAS instance to provide:
- AI agents that make calls, send messages, negotiate on your behalf
- Analytics and reporting on top of your ATLAS data
- Managed ATLAS hosting (if you prefer not to self-host)
- Enterprise connectors and SLA support

→ [Learn more about Cargofy](https://cargofy.com)

---

## Contributing

ATLAS is Apache 2.0 licensed. Contributions welcome.

```bash
git clone https://github.com/cargofy/atlas
cd atlas
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE)


---

## Listed In

ATLAS is submitted to the following MCP directories and lists:

[![punkpeye/awesome-mcp-servers](https://img.shields.io/badge/awesome--mcp--servers-punkpeye-blue?logo=github)](https://github.com/punkpeye/awesome-mcp-servers)
[![appcypher/awesome-mcp-servers](https://img.shields.io/badge/awesome--mcp--servers-appcypher-blue?logo=github)](https://github.com/appcypher/awesome-mcp-servers)
[![wong2/awesome-mcp-servers](https://img.shields.io/badge/awesome--mcp--servers-wong2-blue?logo=github)](https://github.com/wong2/awesome-mcp-servers)
[![modelcontextprotocol/servers](https://img.shields.io/badge/MCP%20Official-Community%20Server-green?logo=github)](https://github.com/modelcontextprotocol/servers)
[![PulseMCP](https://img.shields.io/badge/PulseMCP-Listed-orange)](https://pulsemcp.com)
[![MCP Index](https://img.shields.io/badge/MCP%20Index-Listed-purple)](https://mcpindex.net)
[![Cursor Directory](https://img.shields.io/badge/Cursor%20Directory-Listed-black)](https://cursor.directory)

> Submit, discover, and explore MCP servers in the ecosystem.
