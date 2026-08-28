#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const entries = catalog.extensions;
if (catalog.schemaVersion !== 1 || catalog.status !== "compatibility-only" || catalog.supportedClientMax !== "legacy") {
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
  if (entry.status !== "deprecated" || typeof entry.replacementId !== "string" || !entry.replacementId) {
    throw new Error(`${entry.id}: compatibility entries must declare deprecation and replacement`);
  }
  edges.set(entry.id, entry.replacementId);
}
for (const [id, replacement] of edges) {
  if (replacement === id || edges.has(replacement)) throw new Error(`${id}: replacement chain must terminate outside the legacy catalog`);
}
console.log(`Validated ${entries.length} compatibility entries.`);
