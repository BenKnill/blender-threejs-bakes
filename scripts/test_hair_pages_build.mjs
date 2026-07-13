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
  "vendor/utils/BufferGeometryUtils.js",
  "build.json",
]) {
  await access(path.join(output, relativePath));
}

const moduleSpecifiers = (source) => {
  const specifiers = [];
  const pattern = /(?:import|export)\s+(?:[^'\"]*?\s+from\s*)?["']([^"']+)["']/gs;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers;
};

const resolveModule = (importer, specifier) => {
  const cleanSpecifier = specifier.replace(/[?#].*$/, "");
  if (cleanSpecifier === "three") {
    return path.join(output, "vendor/three.module.js");
  }
  if (cleanSpecifier.startsWith("three/addons/")) {
    return path.join(output, "vendor", cleanSpecifier.slice("three/addons/".length));
  }
  if (cleanSpecifier.startsWith(".")) {
    return path.resolve(path.dirname(importer), cleanSpecifier);
  }
  throw new Error(`unsupported bare module import ${specifier} in ${path.relative(output, importer)}`);
};

const pendingModules = [path.join(output, "main.js")];
const visitedModules = new Set();
while (pendingModules.length > 0) {
  const modulePath = pendingModules.pop();
  if (visitedModules.has(modulePath)) continue;
  assert.ok(
    modulePath.startsWith(`${output}${path.sep}`),
    `module import escapes Pages bundle: ${modulePath}`
  );
  await access(modulePath);
  visitedModules.add(modulePath);
  const source = await readFile(modulePath, "utf8");
  for (const specifier of moduleSpecifiers(source)) {
    pendingModules.push(resolveModule(modulePath, specifier));
  }
}
assert.ok(visitedModules.has(path.join(output, "vendor/utils/BufferGeometryUtils.js")));

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
