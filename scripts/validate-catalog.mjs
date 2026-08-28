#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function validateCatalog(catalog) {
  const entries = catalog?.extensions;
  if (catalog?.schemaVersion !== 1 || catalog.status !== "compatibility-only" || catalog.supportedClientMax !== "legacy") {
    throw new Error("catalog must declare schemaVersion 1 and compatibility-only status");
  }
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("extensions must be a non-empty array");

  const ids = new Set();
  const edges = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || ids.has(entry.id)) throw new Error("duplicate or invalid extension id");
    ids.add(entry.id);
    if (typeof entry.name !== "string" || typeof entry.description !== "string") throw new Error(`${entry.id}: name/description required`);
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(entry.version)) throw new Error(`${entry.id}: invalid semver`);
    if (!/^https:\/\//.test(entry.iconUrl) || !/^https:\/\//.test(entry.downloadUrl)) throw new Error(`${entry.id}: HTTPS URLs required`);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.size) || entry.size <= 0) throw new Error(`${entry.id}: invalid artifact integrity`);
    if (entry.status === "deprecated") {
      if (typeof entry.replacementId !== "string" || !entry.replacementId || entry.replacementId === entry.id) throw new Error(`${entry.id}: deprecated entries require a distinct replacementId`);
      if (typeof entry.deprecationReason !== "string" || !entry.deprecationReason.trim()) throw new Error(`${entry.id}: deprecationReason is required`);
      edges.set(entry.id, entry.replacementId);
    } else if (entry.status !== "legacy") {
      throw new Error(`${entry.id}: compatibility entries must be legacy or deprecated`);
    }
  }
  for (const [id, replacement] of edges) {
    if (edges.has(replacement)) throw new Error(`${id}: replacement chain must terminate outside the legacy catalog`);
  }
  return true;
}

async function main() {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  validateCatalog(catalog);
  console.log(`Validated ${catalog.extensions.length} compatibility entries.`);
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
