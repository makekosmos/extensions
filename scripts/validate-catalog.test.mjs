import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCatalog } from "./validate-catalog.mjs";

const source = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const copy = () => structuredClone(source);

test("accepts frozen compatibility catalog", () => assert.equal(validateCatalog(source), true));

for (const [name, mutate, pattern] of [
  ["duplicate identities", (c) => c.extensions.push(structuredClone(c.extensions[0])), /duplicate/],
  ["bad artifact URL", (c) => { c.extensions[0].downloadUrl = "http://example.invalid/a.kext"; }, /HTTPS/],
  ["bad artifact hash", (c) => { c.extensions[0].sha256 = "bad"; }, /integrity/],
  ["missing replacement metadata", (c) => { c.extensions[1].replacementId = ""; }, /replacementId/],
  ["missing deprecation reason", (c) => { c.extensions[1].deprecationReason = ""; }, /deprecationReason/],
  ["replacement cycle", (c) => {
    c.extensions[1].replacementId = "arrancador";
    c.extensions[2].replacementId = "arcadia";
  }, /replacement chain/],
  ["active entry in compatibility feed", (c) => { c.extensions[0].status = "active"; }, /legacy or deprecated/],
]) {
  test(name, () => assert.throws(() => {
    const c = copy();
    mutate(c);
    validateCatalog(c);
  }, pattern));
}
