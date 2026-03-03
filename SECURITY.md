# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes    |

We commit to patching security vulnerabilities in the latest stable release.

## Reporting a Vulnerability

**Please do not report security vulnerabilities as public GitHub issues.**

If you've found a security issue in ATLAS, report it privately:

1. **Email:** security@cargofy.io (PGP key available on request)
2. **GitHub Security Advisories:** Use [Report a vulnerability](https://github.com/cargofy/ATLAS/security/advisories/new) in the GitHub Security tab

### What to include

- Description of the vulnerability and its impact
- Steps to reproduce (proof-of-concept if possible)
- Affected versions
- Any suggested fix

### Response timeline

| Stage | Timeline |
|-------|----------|
| Initial acknowledgment | 48 hours |
| Severity assessment | 5 business days |
| Patch release (critical) | 7 days |
| Patch release (high) | 30 days |
| Public disclosure | After patch is released |

We follow coordinated disclosure. If you report in good faith, we will not take legal action.

---

## Security Considerations for ATLAS Deployments

### Credentials

ATLAS handles sensitive logistics data and often connects to internal systems. Follow these practices:

- **Never commit credentials** — use environment variables or a secrets manager
- Store email passwords in `EMAIL_PASSWORD` env var, not in `config.yml`
- Store API keys in env vars referenced in config: `${TMS_API_KEY}`
- Use Docker secrets or Kubernetes secrets for production deployments

### Network

- ATLAS runs on port 3000 by default — **do not expose it to the public internet**
- Place ATLAS behind an internal reverse proxy (nginx, Traefik) with authentication
- Restrict Docker network access (`internal: true` on custom networks)
- Use TLS for any external-facing endpoints

### Filesystem Connector

- Mount data directories as **read-only** in Docker: `:ro`
- ATLAS does not modify source files, but validate your mount paths
- Avoid mounting directories containing secrets or sensitive configs

### Database

- SQLite database (`atlas.db`) contains indexed logistics data — protect the file
- Use filesystem permissions: `chmod 600 atlas.db`
- For production, consider PostgreSQL with proper access controls (v0.2+)

### Input Validation

- All MCP tool inputs are validated with Zod schemas before processing
- SQL queries use parameterized statements — no dynamic SQL concatenation
- File paths in filesystem connector are restricted to configured directories

---

## Known Limitations (v0.1)

- Email and API connectors are stubs — no auth flows implemented yet
- No authentication on the MCP server itself (relies on transport-level security)
- SQLite is single-file, single-writer — suitable for development and small deployments only

These are addressed in the [ROADMAP](ROADMAP.md).
