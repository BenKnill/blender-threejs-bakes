#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [motionPath, receiptPath, outputDirectory] = process.argv.slice(2);
if (!motionPath || !receiptPath || !outputDirectory) {
  throw new Error("usage: export_hair_box3d_clip.mjs MOTION.csv RECEIPT.json OUTPUT_DIRECTORY");
}

const condition = "rotating_wind_stiction";
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
const guideCount = receipt.configuration.guides;
const segments = receipt.configuration.links_per_guide;
const particlesPerGuide = segments + 1;
const halfLength = 0.14;
const quantizationMeters = 0.000125;
const sampleHz = 15;

function rotateYAxis(qx, qy, qz, qw) {
  const crossX = -qz;
  const crossZ = qx;
  return [
    2 * qw * crossX + 2 * qy * crossZ,
    1 + 2 * (qz * crossX - qx * crossZ),
    2 * qw * crossZ - 2 * qy * crossX,
  ];
}

const source = await readFile(motionPath, "utf8");
const lines = source.trim().split(/\r?\n/);
const headers = lines.shift().split(",");
const column = Object.fromEntries(headers.map((header, index) => [header, index]));
const selected = lines.filter((line) => line.startsWith(`${condition},`));
if (selected.length === 0) throw new Error(`condition ${condition} is absent from ${motionPath}`);

let maximumFrame = 0;
for (const line of selected) {
  const fields = line.split(",");
  maximumFrame = Math.max(maximumFrame, Number(fields[column.frame]));
}
const frameCount = maximumFrame + 1;
const valueCount = frameCount * guideCount * particlesPerGuide * 3;
const quantized = new Int16Array(valueCount);
let clippedValues = 0;

function writePoint(frame, guide, particle, x, y, z) {
  const offset = ((frame * guideCount + guide) * particlesPerGuide + particle) * 3;
  for (const [axis, value] of [x, y, z].entries()) {
    const encoded = Math.round(value / quantizationMeters);
    if (encoded < -32768 || encoded > 32767) clippedValues += 1;
    quantized[offset + axis] = Math.max(-32768, Math.min(32767, encoded));
  }
}

for (const line of selected) {
  const fields = line.split(",");
  const frame = Number(fields[column.frame]);
  const guide = Number(fields[column.guide]);
  const link = Number(fields[column.link]);
  if (guide >= guideCount || link >= segments) continue;
  const x = Number(fields[column.x_m]);
  const y = Number(fields[column.y_m]);
  const z = Number(fields[column.z_m]);
  const axis = rotateYAxis(
    Number(fields[column.qx]),
    Number(fields[column.qy]),
    Number(fields[column.qz]),
    Number(fields[column.qw])
  );
  if (link === 0) {
    writePoint(
      frame,
      guide,
      0,
      x + halfLength * axis[0],
      y + halfLength * axis[1],
      z + halfLength * axis[2]
    );
  }
  writePoint(
    frame,
    guide,
    link + 1,
    x - halfLength * axis[0],
    y - halfLength * axis[1],
    z - halfLength * axis[2]
  );
}

if (clippedValues !== 0) throw new Error(`${clippedValues} clip values exceeded int16 range`);

const acceptedCondition = receipt.conditions[condition];
const binary = Buffer.from(quantized.buffer);
const binaryName = `box3d_scalp_groom_${guideCount}.positions.i16`;
const metadataName = `box3d_scalp_groom_${guideCount}.meta.json`;
const metadata = {
  schema: "hair-box3d-guide-clip/1",
  fixture: receipt.configuration.fixture,
  condition,
  guide_count: guideCount,
  segments,
  particles_per_guide: particlesPerGuide,
  frame_count: frameCount,
  sample_hz: sampleHz,
  duration_s: (frameCount - 1) / sampleHz,
  quantization_m: quantizationMeters,
  binary: binaryName,
  binary_bytes: binary.byteLength,
  binary_sha256: createHash("sha256").update(binary).digest("hex"),
  trajectory_digest: acceptedCondition.trajectory_digest,
  accepted_metrics: {
    max_settled_joint_gap_m: acceptedCondition.max_settled_joint_gap_m,
    minimum_settled_root_target_dot: acceptedCondition.settled_root_alignment.minimum_target_dot,
    mean_settled_root_target_dot: acceptedCondition.settled_root_alignment.mean_target_dot,
    minimum_settled_root_outward_dot: acceptedCondition.settled_root_alignment.minimum_outward_dot,
    mean_settled_root_outward_dot: acceptedCondition.settled_root_alignment.mean_outward_dot,
    captures: acceptedCondition.stiction.captures,
    releases: acceptedCondition.stiction.releases,
    mean_relative_speed_before_m_s: acceptedCondition.stiction.mean_relative_speed_before_m_s,
    mean_predicted_speed_after_m_s: acceptedCondition.stiction.mean_predicted_speed_after_m_s,
  },
  visible_fiber_target: 5376,
  root_mechanics: "styled_spherical_joint_frames_plus_12_degree_root_cone",
  head_collision: false,
  physics_authority: "native_box3d_precomputed_capsule_transforms",
  display_boundary:
    "browser linearly interpolates recorded guide nodes and hydrates them; it does not rerun Box3D, and the mannequin is a visual plate rather than a collision proxy",
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, binaryName), binary);
await writeFile(path.join(outputDirectory, metadataName), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(JSON.stringify(metadata, null, 2));
