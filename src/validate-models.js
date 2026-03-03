/**
 * ATLAS Model Validator
 * Validates all JSON Schema files in models/ using AJV
 */
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const modelsDir = join(__dirname, "..", "models");

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

// Meta-schema for JSON Schema 2020-12
const metaSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
};

let passed = 0;
let failed = 0;

const files = readdirSync(modelsDir).filter((f) => f.endsWith(".json"));

if (files.length === 0) {
  console.error("No JSON schema files found in models/");
  process.exit(1);
}

for (const file of files) {
  const filePath = join(modelsDir, file);
  let schema;

  try {
    const raw = readFileSync(filePath, "utf8");
    schema = JSON.parse(raw);
  } catch (err) {
    console.error(`✗ ${file} — invalid JSON: ${err.message}`);
    failed++;
    continue;
  }

  // Check required meta fields
  const missing = [];
  if (!schema.$schema) missing.push("$schema");
  if (!schema.$id) missing.push("$id");
  if (!schema.title) missing.push("title");
  if (!schema.type) missing.push("type");

  if (missing.length > 0) {
    console.error(`✗ ${file} — missing fields: ${missing.join(", ")}`);
    failed++;
    continue;
  }

  // Try to compile with AJV
  try {
    ajv.compile(schema);
    console.log(`✓ ${file} — valid JSON Schema`);
    passed++;
  } catch (err) {
    console.error(`✗ ${file} — AJV compile error: ${err.message}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
