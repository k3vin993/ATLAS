# ATLAS Roadmap

> AI Transport Logistics Agent Standard — where we're going

## v0.1 — Foundation (current)

**Status:** ✅ Released

- Core data models: Shipment, Carrier, Route, Document, Rate, Event
- MCP server with 5 tools: `query`, `get_shipment`, `search_carriers`, `get_rate_history`, `list_documents`
- Email, Filesystem, REST API connectors (email/API are stubs for v0.1)
- SQLite storage with JSON extraction queries
- AJV model validation + test suite
- Docker / docker-compose support
- GitHub Actions CI

---

## v0.2 — Intelligence (Q2 2026)

**Goal:** Make ATLAS actually smart, not just a query proxy

- **Vector embeddings** — local semantic search via [ollama](https://ollama.ai) or [sentence-transformers](https://sbert.net)
- **Semantic search** — replace keyword matching with cosine similarity
- **SAP TM connector** — full shipment + rate sync
- **PostgreSQL storage** — optional alternative to SQLite for production scale
- **Email connector (live)** — real IMAP/MIME parsing with [imapflow](https://imapflow.com)
- **Rate extraction from emails** — parse quotes directly from inbox
- **MCP resource endpoints** — expose models/ as MCP resources for AI introspection

---

## v0.3 — Enterprise (Q3 2026)

**Goal:** Connect to the major enterprise logistics platforms

- **Oracle TMS connector**
- **Transporeon connector** (tender management, carrier portal)
- **project44 tracking integration** (real-time multimodal visibility)
- **Freightos / Flexport API** (rate procurement)
- **Multi-tenant support** — multiple companies on one ATLAS instance
- **SSO / SAML authentication** — enterprise identity providers
- **Audit logging** — who queried what, when
- **Webhook push** — push events to external systems when exceptions occur

---

## v1.0 — Standard (Q4 2026)

**Goal:** ATLAS becomes an actual industry standard

- **Stable API contract** — semver, deprecation policy, migration guides
- **Certified connectors program** — third-party connectors audited by maintainers
- **ATLAS-compatible badge** — TMS vendors can self-certify their ATLAS support
- **Community connector marketplace** — curated registry at atlas-standard.org
- **Hosted reference implementation** — sandbox for testing without local setup
- **SDKs** — Python, Go client libraries in addition to Node.js MCP

---

## Backlog / Ideas

- CargoWise One connector
- Customs EDI (EDIFACT CUSCAR, X12 315)
- AI-generated Exception Summaries ("3 shipments at risk this week")
- Rate benchmarking against market indices
- Carbon emissions tracking (GLEC Framework)
- Mobile push notifications for exceptions

---

Want to see something on this roadmap faster? [Open an issue](https://github.com/cargofy/ATLAS/issues/new?template=feature_request.md) or submit a PR.
