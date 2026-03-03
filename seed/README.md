# ATLAS Seed Data

This folder contains example data files you can load into ATLAS to get started quickly.
Drop your own files here in the same format and run:

```bash
atlas seed ./seed/
```

ATLAS maps filename → entity automatically:

| File | Entity | Format |
|------|--------|--------|
| `shipments.json` | shipments | JSON array |
| `carriers.json` | carriers | JSON array |
| `rates.csv` | rates | CSV with header |
| `lanes.json` | lanes | JSON array |
| `documents.json` | documents | JSON array |
| `parties.json` | parties | JSON array |
| `tracking_events.json` | tracking_events | JSON array |
| `service_levels.json` | service_levels | JSON array |
| `extensions/tenders.json` | tenders | JSON array |
| `extensions/assets.json` | assets | JSON array |
| `extensions/issues.json` | issues | JSON array |

## Loading your own data

1. Copy your TMS export (JSON or CSV) into this folder
2. Rename to match the entity name: `shipments.json`, `carriers.csv`, etc.
3. Run `atlas seed ./seed/` — ATLAS maps columns to schema automatically
4. Or use a `connector.mapping` in `config.yml` to map non-standard field names

## Formats

All files support: `.json`, `.csv`, `.xlsx` / `.xls`

JSON must be an array: `[ {...}, {...} ]`

CSV must have a header row.

XLSX: first sheet is used, first row is headers.
