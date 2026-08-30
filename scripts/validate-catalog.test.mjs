import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCatalog } from "./validate-catalog.mjs";

const source = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const copy = () => structuredClone(source);

test("accepts frozen compatibility catalog", () => assert.equal(validateCatalog(source), true));

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
]) {
  test(name, () => assert.throws(() => {
    const c = copy();
    mutate(c);
    validateCatalog(c);
  }, pattern));
}
