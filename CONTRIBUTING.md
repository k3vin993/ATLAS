# Contributing to ATLAS

ATLAS is an open standard for logistics AI infrastructure. We welcome contributions from the logistics and tech communities.

## What We Need

- **Connectors** — integrations with TMS, ERP, WMS, visibility platforms
- **Data models** — improvements to existing models or new entity types
- **Documentation** — setup guides, use cases, tutorials
- **Bug fixes** — found something broken? Fix it.

## How to Contribute

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-connector`
3. Make your changes
4. Add tests
5. Submit a PR with a clear description

## Connector Guidelines

Each connector lives in `connectors/<name>/` and must implement the `BaseConnector` interface:

```typescript
interface BaseConnector {
  connect(): Promise<void>
  sync(): Promise<SyncResult>
  disconnect(): Promise<void>
  healthCheck(): Promise<boolean>
}
```

## Data Model Guidelines

Models live in `models/` as JSON Schema files. When adding or modifying models:
- Follow the existing naming conventions
- Include descriptions for all fields
- Cover all relevant transport modes where applicable
- Maintain backward compatibility

## Code of Conduct

Be helpful. Be respectful. Build things that work.

## License

By contributing, you agree your contributions will be licensed under Apache 2.0.
