/**
 * ATLAS Filesystem Connector
 * Indexes documents (PDFs, DOCX, XLSX, JSON, CSV) from configured local paths
 * Extracts text and stores records in ATLAS DB
 */
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, extname, basename } from "path";

const SUPPORTED_EXTENSIONS = new Set([".json", ".txt", ".csv", ".md"]);

// Optional heavy parsers — only used if installed
let pdfParse = null;
let mammoth = null;
let xlsx = null;

async function loadOptionalParsers() {
  try {
    pdfParse = (await import("pdf-parse")).default;
  } catch {
    // pdf-parse not installed — skip PDF extraction
  }
  try {
    mammoth = await import("mammoth");
  } catch {
    // mammoth not installed — skip DOCX extraction
  }
  try {
    xlsx = await import("xlsx");
  } catch {
    // xlsx not installed — skip XLSX extraction
  }
}

export class FilesystemConnector {
  constructor(config = {}) {
    this.paths = config.paths ?? [];
    this.extensions = new Set([
      ...SUPPORTED_EXTENSIONS,
      ...(config.extra_extensions ?? []),
    ]);
    this.indexed = 0;
    this.errors = 0;
  }

  /**
   * Index all files from configured paths and return extracted records
   * @returns {Promise<Array<{path, text, metadata}>>}
   */
  async indexAll() {
    await loadOptionalParsers();

    if (xlsx) this.extensions.add(".xlsx");
    if (pdfParse) this.extensions.add(".pdf");
    if (mammoth) this.extensions.add(".docx");

    const records = [];

    for (const dir of this.paths) {
      if (!existsSync(dir)) {
        console.log(`[ATLAS] Filesystem connector: path not found — ${dir}`);
        continue;
      }
      const found = this._walkDir(dir);
      for (const filePath of found) {
        const record = await this._extractFile(filePath);
        if (record) {
          records.push(record);
          this.indexed++;
        }
      }
    }

    console.log(
      `[ATLAS] Filesystem connector: indexed ${this.indexed} files, ${this.errors} errors`
    );
    return records;
  }

  /**
   * Walk a directory recursively, return file paths matching extensions
   * @param {string} dir
   * @returns {string[]}
   */
  _walkDir(dir) {
    const results = [];
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }

    for (const entry of entries) {
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...this._walkDir(full));
        } else if (this.extensions.has(extname(entry).toLowerCase())) {
          results.push(full);
        }
      } catch {
        // skip unreadable entries
      }
    }
    return results;
  }

  /**
   * Extract text content from a file
   * @param {string} filePath
   * @returns {Promise<{path, text, metadata}|null>}
   */
  async _extractFile(filePath) {
    const ext = extname(filePath).toLowerCase();
    const name = basename(filePath);

    try {
      let text = "";

      if (ext === ".json") {
        const raw = readFileSync(filePath, "utf8");
        const obj = JSON.parse(raw);
        text = JSON.stringify(obj); // searchable flat representation
      } else if (ext === ".csv" || ext === ".txt" || ext === ".md") {
        text = readFileSync(filePath, "utf8");
      } else if (ext === ".pdf" && pdfParse) {
        const buffer = readFileSync(filePath);
        const result = await pdfParse(buffer);
        text = result.text;
      } else if (ext === ".docx" && mammoth) {
        const buffer = readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else if (ext === ".xlsx" && xlsx) {
        const workbook = xlsx.readFile(filePath);
        const sheets = workbook.SheetNames.map((name) =>
          xlsx.utils.sheet_to_csv(workbook.Sheets[name])
        );
        text = sheets.join("\n");
      } else {
        return null;
      }

      const stat = statSync(filePath);
      return {
        path: filePath,
        filename: name,
        text: text.slice(0, 50_000), // cap at 50KB per file
        metadata: {
          size_bytes: stat.size,
          modified_at: stat.mtime.toISOString(),
          extension: ext,
        },
      };
    } catch (err) {
      console.error(`[ATLAS] Filesystem connector: error reading ${filePath} — ${err.message}`);
      this.errors++;
      return null;
    }
  }
}

export default FilesystemConnector;
