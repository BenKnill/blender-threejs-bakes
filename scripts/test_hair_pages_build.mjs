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
  "assets/box3d_scalp_groom_64.meta.json",
  "assets/box3d_scalp_groom_64.positions.i16",
  "assets/box3d_scalp_groom_256.meta.json",
  "assets/box3d_scalp_groom_256.positions.i16",
  "vendor/three.module.js",
  "vendor/controls/OrbitControls.js",
  "vendor/loaders/GLTFLoader.js",
  "vendor/utils/BufferGeometryUtils.js",
  "build.json",
]) {
  await access(path.join(output, relativePath));
}

const nativeClipMetadata = JSON.parse(
  await readFile(path.join(output, "assets/box3d_scalp_groom_256.meta.json"), "utf8")
);
const nativeClipBinary = await stat(
  path.join(output, "assets/box3d_scalp_groom_256.positions.i16")
);
assert.equal(nativeClipMetadata.guide_count, 256);
assert.equal(nativeClipMetadata.segments, 12);
assert.equal(nativeClipMetadata.trajectory_digest, "eb53b6e105f6e58d");
assert.equal(nativeClipMetadata.head_collision, false);
assert.equal(nativeClipMetadata.binary_bytes, nativeClipBinary.size);

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
  throw new Error(
    `unsupported bare module import ${specifier} in ${path.relative(output, importer)}`
  );
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
assert.ok(visitedModules.has(path.join(output, "curated_scenes.js")));

const index = await readFile(path.join(output, "index.html"), "utf8");
assert.ok(index.includes('"three": "./vendor/three.module.js"'));
assert.ok(index.includes('"three/addons/": "./vendor/"'));
assert.ok(index.includes("scene=rig-becomes-hair"));
assert.ok(!index.includes("disney-layered-mass-lab"));
assert.ok(!index.includes("physicsClip=box3d-scalp-256"));
assert.ok(!index.includes("massDensity=1.25"));
assert.ok(!index.includes("windProgram=strong-then-moderate-orbits"));
assert.ok(!index.includes("strongWind="));
assert.ok(!index.includes("moderateWind="));
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
assert.equal(receipt.default_query, "scene=rig-becomes-hair");
assert.ok((await stat(path.join(output, "assets/realistic-head-animation.glb"))).size > 100_000);
const clipMetadata = JSON.parse(
  await readFile(path.join(output, "assets/box3d_scalp_groom_64.meta.json"), "utf8")
);
assert.equal(clipMetadata.schema, "hair-box3d-guide-clip/1");
assert.equal(clipMetadata.guide_count, 64);
assert.equal(clipMetadata.segments, 12);
assert.equal(clipMetadata.visible_fiber_target, 5376);
assert.equal(
  (await stat(path.join(output, "assets/box3d_scalp_groom_64.positions.i16"))).size,
  clipMetadata.binary_bytes
);

console.log("hair Pages bundle: ok");
