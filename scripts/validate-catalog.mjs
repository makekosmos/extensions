#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const hasVisibleText = (value) => typeof value === "string" && /[^\s\p{C}]/u.test(value);

export function validateCatalog(catalog) {
  const entries = catalog?.extensions;
  if (catalog?.schemaVersion !== 1 || catalog.status !== "compatibility-only" || catalog.supportedClientMax !== "legacy") {
    throw new Error("catalog must declare schemaVersion 1 and compatibility-only status");
  }
  const archive = catalog.archive;
  if (!archive || archive.state !== "frozen" || archive.readOnly !== true || archive.newArtifacts !== false || archive.retireAfter !== "consumer-cutover" || archive.sourceOfTruth !== "signed-store-and-package-index") {
    throw new Error("catalog must declare a frozen, read-only archive and consumer cutover");
  }
  const frozenAtMs = Date.parse(`${archive.frozenAt}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(archive.frozenAt) || Number.isNaN(frozenAtMs) || new Date(frozenAtMs).toISOString().slice(0, 10) !== archive.frozenAt) {
    throw new Error("archive.frozenAt must be an ISO date");
  }
  const updatedAt = catalog.updatedAt;
  const updatedAtMs = Date.parse(updatedAt);
  if (typeof updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt) || Number.isNaN(updatedAtMs) || new Date(updatedAtMs).toISOString() !== updatedAt || updatedAt.slice(0, 10) > archive.frozenAt) {
    throw new Error("catalog.updatedAt must be an exact ISO-8601 UTC timestamp on or before the archive.frozenAt date");
  }
  const replacements = catalog.replacements;
  const contract = catalog.migrationContract;
  if (!replacements || typeof replacements !== "object" || Array.isArray(replacements) || contract?.version !== 1 ||
      !hasVisibleText(contract.persistedIds) || !hasVisibleText(contract.settings) ||
      !hasVisibleText(contract.grants) || !hasVisibleText(contract.cutover)) {
    throw new Error("catalog must declare the versioned migration contract");
  }
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("extensions must be a non-empty array");

  const ids = new Set();
  const edges = new Map();
  const replacementTargets = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || ids.has(entry.id)) throw new Error("duplicate or invalid extension id");
    ids.add(entry.id);
    if (!hasVisibleText(entry.name) || !hasVisibleText(entry.description)) throw new Error(`${entry.id}: name/description required`);
    if (entry.author != null && !hasVisibleText(entry.author)) throw new Error(`${entry.id}: author must be null or a non-empty string`);
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/.test(entry.version)) throw new Error(`${entry.id}: invalid semver`);
    if (typeof entry.keplerApiVersion !== "string" || !/^\^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(entry.keplerApiVersion)) throw new Error(`${entry.id}: invalid keplerApiVersion range`);
    let iconUrl;
    let downloadUrl;
    try {
      iconUrl = new URL(entry.iconUrl);
      downloadUrl = new URL(entry.downloadUrl);
    } catch {
      throw new Error(`${entry.id}: invalid artifact URL`);
    }
    if (iconUrl.protocol !== "https:" || downloadUrl.protocol !== "https:" || iconUrl.username || iconUrl.password || downloadUrl.username || downloadUrl.password || iconUrl.port || downloadUrl.port || iconUrl.search || iconUrl.hash || downloadUrl.search || downloadUrl.hash) {
      throw new Error(`${entry.id}: HTTPS URLs required`);
    }
    if (!/^(github\.com|raw\.githubusercontent\.com)$/i.test(iconUrl.hostname) || !/\.(?:png|svg)$/i.test(iconUrl.pathname)) {
      throw new Error(`${entry.id}: iconUrl must be a GitHub image artifact`);
    }
    if (!/^(github\.com|raw\.githubusercontent\.com)$/i.test(downloadUrl.hostname) || !/\.kext$/i.test(downloadUrl.pathname)) {
      throw new Error(`${entry.id}: downloadUrl must be a GitHub .kext artifact`);
    }
    if (!downloadUrl.pathname.toLowerCase().endsWith(`/${entry.id}-v${entry.version}/${entry.id}-${entry.version}.kext`)) {
      throw new Error(`${entry.id}: downloadUrl must be the ${entry.id}-v${entry.version} release artifact`);
    }
    if (!/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.size) || entry.size <= 0) throw new Error(`${entry.id}: invalid artifact integrity`);
    if (entry.status === "deprecated") {
      if (typeof entry.replacementId !== "string" || !entry.replacementId || entry.replacementId === entry.id) throw new Error(`${entry.id}: deprecated entries require a distinct replacementId`);
      if (!hasVisibleText(entry.deprecationReason)) throw new Error(`${entry.id}: deprecationReason is required`);
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
  return true;
}

async function main() {
  const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
  validateCatalog(catalog);
  console.log(`Validated ${catalog.extensions.length} compatibility entries.`);
}

const invoked = process.argv[1];
if (invoked && existsSync(invoked) && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url))) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
