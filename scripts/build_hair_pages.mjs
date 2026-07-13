#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "physics/labs/hair_material/demo");
const output = path.join(root, "dist/hair-material-bench");
const canonicalUrl = "https://hair-material-bench.pages.dev/";
const canonicalParameters = new URLSearchParams([
  ["replay", "1"],
  ["autoplay", "1"],
  ["showcase", "1"],
  ["presentationLoop", "1"],
  ["poseCycle", "1"],
  ["poseSection", "7"],
  ["poseLift", "0.32"],
  ["poseSweep", "0.34"],
  ["groomHydration", "1"],
  ["guides", "256"],
  ["iterations", "6"],
  ["preset", "wavy"],
  ["wetness", "0.35"],
  ["product", "0.45"],
  ["windProgram", "strong-then-moderate-orbits"],
  ["hairRender", "fatline"],
  ["hairShade", "fiber"],
  ["fibers", "21"],
  ["groomVolume", "1"],
  ["rootField", "styled-side-part"],
  ["rootStrength", "0.22"],
  ["faceClear", "1"],
  ["mannequin", "realistic"],
  ["reel", "control"],
  ["renderReceipt", "1"],
  ["scenario", "canonical-visible-two-orbit-wind-demo"],
]).toString();

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

for (const relativePath of [
  "three.module.js",
  "controls/OrbitControls.js",
  "loaders/GLTFLoader.js",
  "utils/BufferGeometryUtils.js",
]) {
  const target = path.join(output, "vendor", relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(root, "editor/vendor", relativePath), target);
}

const indexPath = path.join(output, "index.html");
let index = await readFile(indexPath, "utf8");
const originalThree = '"three": "../../../../editor/vendor/three.module.js"';
const originalAddons = '"three/addons/": "../../../../editor/vendor/"';
if (!index.includes(originalThree) || !index.includes(originalAddons)) {
  throw new Error("hair demo import map no longer matches the Pages packager");
}
index = index
  .replace(originalThree, '"three": "./vendor/three.module.js"')
  .replace(originalAddons, '"three/addons/": "./vendor/"');
const canonicalBootstrap = `    <script>
      if (!window.location.search) {
        window.location.replace(
          window.location.pathname + "?" + ${JSON.stringify(canonicalParameters)}
        );
      }
    </script>
`;
index = index.replace(
  '    <script type="importmap">',
  `${canonicalBootstrap}    <script type="importmap">`
);
await writeFile(indexPath, index);

await writeFile(
  path.join(output, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer

/index.html
  Cache-Control: no-cache

/build.json
  Cache-Control: no-store

/assets/*
  Cache-Control: public, max-age=3600

/vendor/*
  Cache-Control: public, max-age=3600
`
);

const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
await writeFile(
  path.join(output, "build.json"),
  `${JSON.stringify(
    {
      schema: "hair-material-pages-build/1",
      commit,
      built_at: new Date().toISOString(),
      canonical_url: canonicalUrl,
      source_path: "physics/labs/hair_material/demo",
      default_query: canonicalParameters,
      deployment_boundary: "static Cloudflare Pages direct upload",
    },
    null,
    2
  )}\n`
);

console.log(
  JSON.stringify(
    {
      output,
      commit,
      canonical_url: canonicalUrl,
      default_query: canonicalParameters,
    },
    null,
    2
  )
);
