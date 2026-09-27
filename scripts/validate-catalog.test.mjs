import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, symlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "./validate-catalog.mjs";

const source = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const copy = () => structuredClone(source);

test("accepts frozen compatibility catalog", () => assert.equal(validateCatalog(source), true));

test("accepts semver build metadata", () => {
  const c = copy();
  c.extensions[0].version = "1.2.3+build.7";
  assert.equal(validateCatalog(c), true);
});

test("accepts leap-day archive.frozenAt", () => {
  const c = copy();
  c.archive.frozenAt = "2024-02-29";
  assert.equal(validateCatalog(c), true);
});

test("accepts uppercase .KEXT artifact extension", () => {
  const c = copy();
  c.extensions[1].downloadUrl = "https://github.com/makekosmos/extensions/releases/download/arcadia-v0.1.5/arcadia-0.1.5.KEXT";
  assert.equal(validateCatalog(c), true);
});

test("accepts string or absent author", () => {
  const c = copy();
  c.extensions[0].author = "Kosmos";
  assert.equal(validateCatalog(c), true);
  delete c.extensions[0].author;
  assert.equal(validateCatalog(c), true);
});

test("runs validator when invoked through a symlink", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "validate-catalog-"));
  const link = path.join(dir, "validate-catalog.mjs");
  symlinkSync(fileURLToPath(new URL("./validate-catalog.mjs", import.meta.url)), link);
  const output = execFileSync(process.execPath, [link], { encoding: "utf8" });
  assert.match(output, /Validated 5 compatibility entries/);
});

test("uses one canonical replacement for each renamed app", () => {
  assert.deepEqual(source.replacements, {
    arcadia: "com.kosmos.arcadia",
    arrancador: "com.kosmos.arcadia",
    eden: "com.kosmos.memoria",
    delphi: "com.kosmos.agenda",
  });
});

for (const [name, mutate, pattern] of [
  ["duplicate identities", (c) => c.extensions.push(structuredClone(c.extensions[0])), /duplicate/],
  ["blank identity", (c) => { c.extensions[0].id = "   "; }, /invalid extension id/],
  ["blank name", (c) => { c.extensions[0].name = ""; }, /name\/description/],
  ["blank description", (c) => { c.extensions[0].description = " "; }, /name\/description/],
  ["blank contract clause", (c) => { c.migrationContract.grants = ""; }, /migration contract/],
  ["version with leading zeros", (c) => { c.extensions[0].version = "01.2.3"; }, /semver/],
  ["version with empty prerelease identifier", (c) => { c.extensions[0].version = "1.2.3-.."; }, /semver/],
  ["missing keplerApiVersion", (c) => { delete c.extensions[0].keplerApiVersion; }, /keplerApiVersion/],
  ["keplerApiVersion without caret range", (c) => { c.extensions[0].keplerApiVersion = "1.1.0"; }, /keplerApiVersion/],
  ["non-string keplerApiVersion", (c) => { c.extensions[0].keplerApiVersion = 11; }, /keplerApiVersion/],
  ["bad artifact URL", (c) => { c.extensions[0].downloadUrl = "http://example.invalid/a.kext"; }, /HTTPS/],
  ["untrusted icon URL", (c) => { c.extensions[0].iconUrl = "https://example.invalid/icon.svg"; }, /iconUrl/],
  ["bad artifact hash", (c) => { c.extensions[0].sha256 = "bad"; }, /integrity/],
  ["missing replacement metadata", (c) => { c.extensions[1].replacementId = ""; }, /replacementId/],
  ["missing deprecation reason", (c) => { c.extensions[1].deprecationReason = ""; }, /deprecationReason/],
  ["replacement cycle", (c) => {
    c.extensions[1].replacementId = "arrancador";
    c.extensions[2].replacementId = "arcadia";
    c.replacements.arcadia = "arrancador";
    c.replacements.arrancador = "arcadia";
  }, /replacement/],
  ["invalid archive state", (c) => { c.archive.readOnly = false; }, /frozen, read-only archive/],
  ["missing migration contract", (c) => { delete c.migrationContract.grants; }, /migration contract/],
  ["replacement mapping drift", (c) => { c.replacements.eden = "com.kosmos.agenda"; }, /replacementId/],
  ["active entry in compatibility feed", (c) => { c.extensions[0].status = "active"; }, /legacy or deprecated/],
  ["impossible archive.frozenAt date", (c) => { c.archive.frozenAt = "2026-02-30"; }, /ISO date/],
  ["non-default iconUrl port", (c) => { c.extensions[0].iconUrl = "https://github.com:8080/makekosmos/extensions/main/extensions/akasha/icon.svg"; }, /HTTPS/],
  ["non-default downloadUrl port", (c) => { c.extensions[1].downloadUrl = "https://github.com:8443/a/b.kext"; }, /HTTPS/],
  ["non-string author", (c) => { c.extensions[0].author = 42; }, /author/],
  ["blank author", (c) => { c.extensions[1].author = " "; }, /author/],
]) {
  test(name, () => assert.throws(() => {
    const c = copy();
    mutate(c);
    validateCatalog(c);
  }, pattern));
}
