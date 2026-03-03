/**
 * ATLAS Model Tests
 * Basic validation tests for JSON Schema files
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const modelsDir = join(__dirname, "../../models");

const REQUIRED_FIELDS = ["$schema", "$id", "title", "type"];
const EXPECTED_MODELS = [
  "shipment.json",
  "carrier.json",
  "route.json",
  "document.json",
  "rate.json",
  "event.json",
];

describe("ATLAS Data Models", () => {
  it("all expected model files exist", () => {
    const files = readdirSync(modelsDir);
    for (const model of EXPECTED_MODELS) {
      assert.ok(files.includes(model), `Missing model file: ${model}`);
    }
  });

  it("all model files are valid JSON", () => {
    const files = readdirSync(modelsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = readFileSync(join(modelsDir, file), "utf8");
      assert.doesNotThrow(
        () => JSON.parse(raw),
        `${file} is not valid JSON`
      );
    }
  });

  it("all model files have required fields", () => {
    const files = readdirSync(modelsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const schema = JSON.parse(readFileSync(join(modelsDir, file), "utf8"));
      for (const field of REQUIRED_FIELDS) {
        assert.ok(
          schema[field] !== undefined,
          `${file} missing required field: ${field}`
        );
      }
    }
  });

  it("all models reference atlas-standard.org $id", () => {
    const files = readdirSync(modelsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const schema = JSON.parse(readFileSync(join(modelsDir, file), "utf8"));
      assert.ok(
        schema.$id.startsWith("https://atlas-standard.org/"),
        `${file} $id should start with https://atlas-standard.org/`
      );
    }
  });

  it("carrier.json has required logistics fields", () => {
    const schema = JSON.parse(
      readFileSync(join(modelsDir, "carrier.json"), "utf8")
    );
    const props = Object.keys(schema.properties ?? {});
    for (const field of ["id", "name", "type", "country", "rating", "performance"]) {
      assert.ok(props.includes(field), `carrier.json missing property: ${field}`);
    }
  });

  it("event.json has is_exception field", () => {
    const schema = JSON.parse(
      readFileSync(join(modelsDir, "event.json"), "utf8")
    );
    assert.ok(
      schema.properties.is_exception !== undefined,
      "event.json missing is_exception"
    );
  });

  it("rate.json has rate_type enum with spot and contract", () => {
    const schema = JSON.parse(
      readFileSync(join(modelsDir, "rate.json"), "utf8")
    );
    const rateType = schema.properties.rate_type;
    assert.ok(rateType.enum.includes("spot"), "rate.json rate_type missing 'spot'");
    assert.ok(rateType.enum.includes("contract"), "rate.json rate_type missing 'contract'");
  });
});
