#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function validateCatalog(catalog) {
  const entries = catalog?.extensions;
  if (catalog?.schemaVersion !== 1 || catalog.status !== "compatibility-only" || catalog.supportedClientMax !== "legacy") {
    throw new Error("catalog must declare schemaVersion 1 and compatibility-only status");
  }
  const archive = catalog.archive;
  if (!archive || archive.state !== "frozen" || archive.readOnly !== true || archive.newArtifacts !== false || archive.retireAfter !== "consumer-cutover" || archive.sourceOfTruth !== "signed-store-and-package-index") {
    throw new Error("catalog must declare a frozen, read-only archive and consumer cutover");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(archive.frozenAt) || Number.isNaN(Date.parse(`${archive.frozenAt}T00:00:00Z`))) {
    throw new Error("archive.frozenAt must be an ISO date");
  }
  const replacements = catalog.replacements;
  const contract = catalog.migrationContract;
  if (!replacements || typeof replacements !== "object" || contract?.version !== 1 ||
      typeof contract.persistedIds !== "string" || typeof contract.settings !== "string" ||
      typeof contract.grants !== "string" || typeof contract.cutover !== "string") {
    throw new Error("catalog must declare the versioned migration contract");
  }
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("extensions must be a non-empty array");

  const ids = new Set();
  const edges = new Map();
  const replacementTargets = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || ids.has(entry.id)) throw new Error("duplicate or invalid extension id");
    ids.add(entry.id);
    if (typeof entry.name !== "string" || typeof entry.description !== "string") throw new Error(`${entry.id}: name/description required`);
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(entry.version)) throw new Error(`${entry.id}: invalid semver`);
    let iconUrl;
    let downloadUrl;
    try {
      iconUrl = new URL(entry.iconUrl);
      downloadUrl = new URL(entry.downloadUrl);
    } catch {
      throw new Error(`${entry.id}: invalid artifact URL`);
    }
    if (iconUrl.protocol !== "https:" || downloadUrl.protocol !== "https:" || iconUrl.username || iconUrl.password || downloadUrl.username || downloadUrl.password || iconUrl.search || iconUrl.hash || downloadUrl.search || downloadUrl.hash) {
      throw new Error(`${entry.id}: HTTPS URLs required`);
    }
    if (!/^(github\.com|raw\.githubusercontent\.com)$/i.test(iconUrl.hostname) || !/\.(?:png|svg)$/i.test(iconUrl.pathname)) {
      throw new Error(`${entry.id}: iconUrl must be a GitHub image artifact`);
    }
    if (!/^(github\.com|raw\.githubusercontent\.com)$/i.test(downloadUrl.hostname) || !downloadUrl.pathname.endsWith(".kext")) {
      throw new Error(`${entry.id}: downloadUrl must be a GitHub .kext artifact`);
    }
    if (!/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.size) || entry.size <= 0) throw new Error(`${entry.id}: invalid artifact integrity`);
    if (entry.status === "deprecated") {
      if (typeof entry.replacementId !== "string" || !entry.replacementId || entry.replacementId === entry.id) throw new Error(`${entry.id}: deprecated entries require a distinct replacementId`);
      if (typeof entry.deprecationReason !== "string" || !entry.deprecationReason.trim()) throw new Error(`${entry.id}: deprecationReason is required`);
      edges.set(entry.id, entry.replacementId);
      replacementTargets.add(entry.replacementId);
      if (replacements[entry.id] !== entry.replacementId) throw new Error(`${entry.id}: replacementId must match catalog.replacements`);
    } else if (entry.replacementId !== undefined || entry.deprecationReason !== undefined) {
      throw new Error(`${entry.id}: legacy entries cannot carry replacement metadata`);
    } else if (entry.status !== "legacy") {
      throw new Error(`${entry.id}: compatibility entries must be legacy or deprecated; active entries are forbidden`);
    }
  }
  for (const [id, replacement] of Object.entries(replacements)) {
    if (!ids.has(id) || typeof replacement !== "string") {
      throw new Error(`${id}: invalid replacement mapping`);
    }
    if (ids.has(replacement)) throw new Error(`${id}: replacement chain must terminate outside the legacy catalog`);
    if (!/^com\.kosmos\.[a-z0-9-]+$/.test(replacement)) throw new Error(`${id}: invalid replacement mapping`);
    if (edges.get(id) !== replacement) throw new Error(`${id}: replacement mapping has no matching deprecated entry`);
  }
  for (const id of edges.keys()) {
    if (!Object.hasOwn(replacements, id)) throw new Error(`${id}: replacement mapping is missing`);
  }
  for (const [id, replacement] of edges) {
    if (ids.has(replacement) || edges.has(replacement)) throw new Error(`${id}: replacement chain must terminate outside the legacy catalog`);
  }
  if (replacementTargets.size === 0) throw new Error("catalog must contain at least one replacement");
  if (entries.some((entry) => ["active", "current", "published"].includes(entry.status))) {
    throw new Error("active entries are forbidden in compatibility-only catalog");
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
