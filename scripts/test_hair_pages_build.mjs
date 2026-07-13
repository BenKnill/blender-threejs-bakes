#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist/hair-material-bench");

execFileSync(process.execPath, [path.join(root, "scripts/build_hair_pages.mjs")], {
  cwd: root,
  stdio: "pipe",
});

for (const relativePath of [
  "index.html",
  "main.js",
  "solver.js",
  "styles.css",
  "assets/realistic-head-animation.glb",
  "vendor/three.module.js",
  "vendor/controls/OrbitControls.js",
  "vendor/loaders/GLTFLoader.js",
  "build.json",
]) {
  await access(path.join(output, relativePath));
}

const index = await readFile(path.join(output, "index.html"), "utf8");
assert.ok(index.includes('"three": "./vendor/three.module.js"'));
assert.ok(index.includes('"three/addons/": "./vendor/"'));
assert.ok(index.includes("canonical-pages-hair-demo"));
assert.ok(!index.includes("../../../../editor/vendor"));

const receipt = JSON.parse(await readFile(path.join(output, "build.json"), "utf8"));
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
assert.equal(receipt.schema, "hair-material-pages-build/1");
assert.equal(receipt.commit, commit);
assert.equal(receipt.canonical_url, "https://hair-material-bench.pages.dev/");
assert.equal(receipt.source_path, "physics/labs/hair_material/demo");
assert.ok((await stat(path.join(output, "assets/realistic-head-animation.glb"))).size > 100_000);

console.log("hair Pages bundle: ok");
