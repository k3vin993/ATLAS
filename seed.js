/**
 * ATLAS Seed Data
 * Loads sample logistics data into a local ATLAS instance for testing
 * Usage: node seed.js [db-path]
 */
import { Atlas } from "./src/atlas.js";

const atlas = new Atlas();
atlas.initDb(process.argv[2] ?? ":memory:");

// ── Sample carriers ──────────────────────────────────────────────────────────

const carriers = [
  {
    id: "c-dhl-de",
    name: "DHL Freight",
    type: "trucking",
    country: "DE",
    rating: 4.7,
    modes: ["road"],
    contacts: [{ name: "Key Account", email: "key.account@dhl.com" }],
    performance: { on_time_rate: 0.94, damage_rate: 0.002, avg_transit_days: 2.1 },
  },
  {
    id: "c-dsv-dk",
    name: "DSV Road",
    type: "trucking",
    country: "DK",
    rating: 4.5,
    modes: ["road", "multimodal"],
    contacts: [{ name: "Sales", email: "sales@dsv.com" }],
    performance: { on_time_rate: 0.91, damage_rate: 0.003, avg_transit_days: 2.8 },
  },
  {
    id: "c-maersk-dk",
    name: "Maersk Line",
    type: "shipping_line",
    country: "DK",
    rating: 4.3,
    modes: ["ocean"],
    contacts: [{ name: "Commercial", email: "commercial@maersk.com" }],
    performance: { on_time_rate: 0.78, damage_rate: 0.001, avg_transit_days: 18.5 },
  },
  {
    id: "c-lufthansa-de",
    name: "Lufthansa Cargo",
    type: "airline",
    country: "DE",
    rating: 4.6,
    modes: ["air"],
    contacts: [{ name: "Cargo Sales", email: "cargo@lufthansa.com" }],
    performance: { on_time_rate: 0.89, damage_rate: 0.001, avg_transit_days: 1.2 },
  },
];

for (const c of carriers) {
  atlas.db.prepare("INSERT OR REPLACE INTO carriers (id, data) VALUES (?, ?)").run(c.id, JSON.stringify(c));
}

// ── Sample shipments ─────────────────────────────────────────────────────────

const shipments = [
  {
    id: "shp-001",
    reference: "FWD-2025-001",
    mode: "road",
    status: "delivered",
    origin: { city: "Warsaw", country: "PL" },
    destination: { city: "Hamburg", country: "DE" },
    carrier: { id: "c-dhl-de", name: "DHL Freight" },
    cargo: { description: "Auto parts", weight_kg: 4200, unit_type: "pallet", units: 18 },
    dates: { pickup_planned: "2025-11-10T08:00:00Z", delivery_actual: "2025-11-12T14:30:00Z" },
    financials: { currency: "EUR", agreed_rate: 1850, final_cost: 1850 },
  },
  {
    id: "shp-002",
    reference: "FWD-2025-002",
    mode: "road",
    status: "in_transit",
    origin: { city: "Kyiv", country: "UA" },
    destination: { city: "Berlin", country: "DE" },
    carrier: { id: "c-dsv-dk", name: "DSV Road" },
    cargo: { description: "Electronics", weight_kg: 800, unit_type: "box", units: 40 },
    dates: { pickup_planned: "2025-11-14T09:00:00Z", delivery_planned: "2025-11-17T16:00:00Z" },
    financials: { currency: "EUR", agreed_rate: 2400 },
  },
  {
    id: "shp-003",
    reference: "FWD-2025-003",
    mode: "ocean",
    status: "in_transit",
    origin: { city: "Shanghai", country: "CN" },
    destination: { city: "Rotterdam", country: "NL" },
    carrier: { id: "c-maersk-dk", name: "Maersk Line" },
    cargo: { description: "Consumer goods", weight_kg: 22000, unit_type: "container", units: 1 },
    dates: { etd: "2025-10-28T00:00:00Z", eta: "2025-11-22T00:00:00Z" },
    financials: { currency: "USD", agreed_rate: 3200 },
  },
];

for (const s of shipments) {
  atlas.db.prepare("INSERT OR REPLACE INTO shipments (id, data) VALUES (?, ?)").run(s.id, JSON.stringify(s));
}

// ── Sample rates ─────────────────────────────────────────────────────────────

const rates = [
  {
    id: "rate-001",
    carrier_id: "c-dhl-de",
    origin_country: "PL",
    destination_country: "DE",
    mode: "road",
    rate_type: "contract",
    valid_from: "2025-01-01",
    valid_to: "2025-12-31",
    currency: "EUR",
    base_rate: 1750,
    per_kg: null,
    weight_break_kg: null,
    notes: "Full truck, standard lanes",
  },
  {
    id: "rate-002",
    carrier_id: "c-dsv-dk",
    origin_country: "UA",
    destination_country: "DE",
    mode: "road",
    rate_type: "spot",
    valid_from: "2025-11-01",
    valid_to: "2025-11-30",
    currency: "EUR",
    base_rate: 2400,
    notes: "Spot rate, border delays possible",
  },
  {
    id: "rate-003",
    carrier_id: "c-maersk-dk",
    origin_country: "CN",
    destination_country: "NL",
    mode: "ocean",
    rate_type: "spot",
    valid_from: "2025-10-01",
    valid_to: "2025-12-31",
    currency: "USD",
    base_rate: 3200,
    notes: "20ft container, all-in",
  },
];

for (const r of rates) {
  atlas.db.prepare(
    "INSERT OR REPLACE INTO rates (id, carrier_id, origin_country, destination_country, mode, valid_from, valid_to, data) VALUES (?,?,?,?,?,?,?,?)"
  ).run(r.id, r.carrier_id, r.origin_country, r.destination_country, r.mode, r.valid_from, r.valid_to, JSON.stringify(r));
}

console.log(`✓ Seeded ${carriers.length} carriers, ${shipments.length} shipments, ${rates.length} rates`);
