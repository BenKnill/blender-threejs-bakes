export const FATLINE_ROOT_HALF_WIDTH_PX = 0.84;
export const FATLINE_TIP_HALF_WIDTH_PX = 0.07;
export const HAIR_FIBER_SHADING_ID = "tangent_dual_lobe_root_emergence_v2";
export const HAIR_PRESENTATION_LOOP_ID = "two_wind_orbits_1020_step_v2";
export const REEL_CAMERA_FIELD_ID = "fixed_control_two_orbit_1020_step_v3";
export const FULL_GROOM_HYDRATION_ID = "uniform_rod_joint_hydration_450_v3";
export const PHYSICS_SKELETON_STYLE_ID = "uniform_world_space_rods_joints_v1";
export const LOCK_AWARE_COVERAGE_ID = "live_root_cover_locks_catmull_rom_v3";
export const LOCK_AWARE_RENDER_SUBDIVISIONS = 2;
export const LOCK_AWARE_ROOT_COVER_SEGMENTS = 3;
export const LOCK_AWARE_ROOT_COVER_LENGTH_METERS = 0.24;
export const LOCK_AWARE_ROOT_COVER_PROBE_PARTICLE = 7;
export const LOCK_AWARE_ROOT_COVER_LIVE_WEIGHT = 0.86;
export const LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT = 0.34;
export const PHYSICS_SKELETON_STYLE = Object.freeze({
  guideLimit: 20,
  rodRadiusMeters: 0.011,
  jointRadiusMeters: 0.02,
  rootJointScale: 1,
  depthWriteMinimumOpacity: 0.5,
});

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function wrappedAngleDistance(left, right) {
  const direct = Math.abs(left - right) % (Math.PI * 2);
  return Math.min(direct, Math.PI * 2 - direct);
}

const ROOT_COVER_FRACTIONS = Object.freeze([0, 0.34, 0.7, 1]);
const ROOT_COVER_LIFTS = Object.freeze([0, 0.055, 0.085, 0.065]);

export function catmullRomScalar(p0, p1, p2, p3, t, tangentScale = 0.5) {
  const clamped = Math.max(0, Math.min(1, t));
  const t2 = clamped * clamped;
  const t3 = t2 * clamped;
  const m1 = (p2 - p0) * tangentScale;
  const m2 = (p3 - p1) * tangentScale;
  return (
    (2 * t3 - 3 * t2 + 1) * p1 +
    (t3 - 2 * t2 + clamped) * m1 +
    (-2 * t3 + 3 * t2) * p2 +
    (t3 - t2) * m2
  );
}

export function blendRootCoverageFlow(
  normalX,
  normalY,
  normalZ,
  authoredX,
  authoredY,
  authoredZ,
  liveX,
  liveY,
  liveZ,
  liveWeight = LOCK_AWARE_ROOT_COVER_LIVE_WEIGHT,
  output = []
) {
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
  const nx = normalX / normalLength;
  const ny = normalY / normalLength;
  const nz = normalZ / normalLength;
  const authoredOutward = authoredX * nx + authoredY * ny + authoredZ * nz;
  let authoredTangentX = authoredX - authoredOutward * nx;
  let authoredTangentY = authoredY - authoredOutward * ny;
  let authoredTangentZ = authoredZ - authoredOutward * nz;
  let authoredLength = Math.hypot(authoredTangentX, authoredTangentY, authoredTangentZ);
  if (authoredLength < 1e-8) {
    authoredTangentX = nz;
    authoredTangentY = 0;
    authoredTangentZ = -nx;
    authoredLength = Math.hypot(authoredTangentX, authoredTangentY, authoredTangentZ) || 1;
  }
  authoredTangentX /= authoredLength;
  authoredTangentY /= authoredLength;
  authoredTangentZ /= authoredLength;
  const liveOutward = liveX * nx + liveY * ny + liveZ * nz;
  let liveTangentX = liveX - liveOutward * nx;
  let liveTangentY = liveY - liveOutward * ny;
  let liveTangentZ = liveZ - liveOutward * nz;
  let liveLength = Math.hypot(liveTangentX, liveTangentY, liveTangentZ);
  if (liveLength < 1e-8) {
    liveTangentX = authoredTangentX;
    liveTangentY = authoredTangentY;
    liveTangentZ = authoredTangentZ;
    liveLength = 1;
  }
  liveTangentX /= liveLength;
  liveTangentY /= liveLength;
  liveTangentZ /= liveLength;
  const weight = Math.max(0, Math.min(1, liveWeight));
  let flowX = authoredTangentX * (1 - weight) + liveTangentX * weight;
  let flowY = authoredTangentY * (1 - weight) + liveTangentY * weight;
  let flowZ = authoredTangentZ * (1 - weight) + liveTangentZ * weight;
  const flowLength = Math.hypot(flowX, flowY, flowZ) || 1;
  flowX /= flowLength;
  flowY /= flowLength;
  flowZ /= flowLength;
  const authoredDot =
    flowX * authoredTangentX + flowY * authoredTangentY + flowZ * authoredTangentZ;
  if (authoredDot < LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT) {
    let perpendicularX = flowX - authoredDot * authoredTangentX;
    let perpendicularY = flowY - authoredDot * authoredTangentY;
    let perpendicularZ = flowZ - authoredDot * authoredTangentZ;
    let perpendicularLength = Math.hypot(perpendicularX, perpendicularY, perpendicularZ);
    if (perpendicularLength < 1e-8) {
      perpendicularX = ny * authoredTangentZ - nz * authoredTangentY;
      perpendicularY = nz * authoredTangentX - nx * authoredTangentZ;
      perpendicularZ = nx * authoredTangentY - ny * authoredTangentX;
      perpendicularLength = Math.hypot(perpendicularX, perpendicularY, perpendicularZ) || 1;
    }
    const perpendicularScale =
      Math.sqrt(1 - LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT ** 2) / perpendicularLength;
    flowX =
      authoredTangentX * LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT +
      perpendicularX * perpendicularScale;
    flowY =
      authoredTangentY * LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT +
      perpendicularY * perpendicularScale;
    flowZ =
      authoredTangentZ * LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT +
      perpendicularZ * perpendicularScale;
  }
  output[0] = flowX;
  output[1] = flowY;
  output[2] = flowZ;
  return output;
}

export function buildRootCoverageCurve(
  rootX,
  rootY,
  rootZ,
  normalX,
  normalY,
  normalZ,
  targetX,
  targetY,
  targetZ,
  strand,
  copy,
  length,
  output = new Float64Array(12)
) {
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
  const nx = normalX / normalLength;
  const ny = normalY / normalLength;
  const nz = normalZ / normalLength;
  const outward = targetX * nx + targetY * ny + targetZ * nz;
  let tx = targetX - outward * nx;
  let ty = targetY - outward * ny;
  let tz = targetZ - outward * nz;
  let tangentLength = Math.hypot(tx, ty, tz);
  if (tangentLength < 1e-8) {
    tx = nz;
    ty = 0;
    tz = -nx;
    tangentLength = Math.hypot(tx, ty, tz) || 1;
  }
  tx /= tangentLength;
  ty /= tangentLength;
  tz /= tangentLength;
  let bx = ny * tz - nz * ty;
  let by = nz * tx - nx * tz;
  let bz = nx * ty - ny * tx;
  const binormalLength = Math.hypot(bx, by, bz) || 1;
  bx /= binormalLength;
  by /= binormalLength;
  bz /= binormalLength;

  let hash = Math.imul(strand + 1, 0x45d9f3b) ^ Math.imul(copy + 1, 0x27d4eb2d);
  hash ^= hash >>> 16;
  const unsigned = hash >>> 0;
  const spreadAngle = (((unsigned & 0x3ff) / 1023) * 2 - 1) * 0.42;
  const spreadCos = Math.cos(spreadAngle);
  const spreadSin = Math.sin(spreadAngle);
  const directionX = tx * spreadCos + bx * spreadSin;
  const directionY = ty * spreadCos + by * spreadSin;
  const directionZ = tz * spreadCos + bz * spreadSin;
  const span = Math.max(0, length) * (0.84 + (((unsigned >>> 10) & 0xff) / 255) * 0.32);
  const sideWave = ((((unsigned >>> 18) & 0xff) / 255) * 2 - 1) * span * 0.035;
  for (let point = 0; point < 4; point += 1) {
    const fraction = ROOT_COVER_FRACTIONS[point];
    const wave = Math.sin(Math.PI * fraction) * sideWave;
    const cursor = point * 3;
    output[cursor] =
      rootX + directionX * span * fraction + bx * wave + nx * span * ROOT_COVER_LIFTS[point];
    output[cursor + 1] =
      rootY + directionY * span * fraction + by * wave + ny * span * ROOT_COVER_LIFTS[point];
    output[cursor + 2] =
      rootZ + directionZ * span * fraction + bz * wave + nz * span * ROOT_COVER_LIFTS[point];
  }
  return output;
}

export function buildUndercoatCoverageProfile(
  rootNormals,
  guideSections,
  slices = 96,
  sectionCount = 8
) {
  const guideCount = rootNormals.length / 3;
  if (
    !Number.isInteger(guideCount) ||
    guideSections.length !== guideCount ||
    !Number.isInteger(slices) ||
    slices < 8 ||
    !Number.isInteger(sectionCount) ||
    sectionCount < 1
  ) {
    throw new Error("undercoat coverage inputs are invalid");
  }
  const sectionEdgeDensity = new Float64Array(sectionCount);
  const guidePhis = new Float64Array(guideCount);
  const guideEdgeWeights = new Float64Array(guideCount);
  for (let guide = 0; guide < guideCount; guide += 1) {
    const normalX = rootNormals[guide * 3];
    const normalY = rootNormals[guide * 3 + 1];
    const normalZ = rootNormals[guide * 3 + 2];
    const section = guideSections[guide] % sectionCount;
    const edgeWeight = smoothStep01((0.9 - normalY) / 0.48);
    guidePhis[guide] = Math.atan2(normalZ, normalX);
    guideEdgeWeights[guide] = edgeWeight;
    sectionEdgeDensity[section] += edgeWeight;
  }
  const maximumSectionDensity = Math.max(1e-9, ...sectionEdgeDensity);
  const localDensity = new Float32Array(slices);
  let maximumLocalDensity = 1e-9;
  for (let slice = 0; slice < slices; slice += 1) {
    const phi = (slice / slices) * Math.PI * 2;
    let density = 0;
    for (let guide = 0; guide < guideCount; guide += 1) {
      const distance = wrappedAngleDistance(phi, guidePhis[guide]);
      const angularWeight = Math.max(0, 1 - distance / 0.34);
      density += angularWeight * angularWeight * guideEdgeWeights[guide];
    }
    localDensity[slice] = density;
    maximumLocalDensity = Math.max(maximumLocalDensity, density);
  }
  const fadeStarts = new Float32Array(slices);
  const densityScales = new Float32Array(slices);
  let minimumFadeStart = 1;
  let maximumFadeStart = 0;
  let densitySum = 0;
  for (let slice = 0; slice < slices; slice += 1) {
    const phi = (slice / slices) * Math.PI * 2;
    const section = Math.min(
      sectionCount - 1,
      Math.floor(((phi + Math.PI) / (Math.PI * 2)) * sectionCount) % sectionCount
    );
    const density = localDensity[slice] / maximumLocalDensity;
    const sectionDensity = sectionEdgeDensity[section] / maximumSectionDensity;
    let hash = Math.imul(slice + 1, 0x45d9f3b) ^ Math.imul(section + 1, 0x27d4eb2d);
    hash ^= hash >>> 16;
    const jitter = ((hash >>> 0) % 101) / 100 - 0.5;
    const fadeStart = Math.max(
      0.64,
      Math.min(0.88, 0.68 + density * 0.13 + sectionDensity * 0.035 + jitter * 0.04)
    );
    fadeStarts[slice] = fadeStart;
    densityScales[slice] = 0.72 + density * 0.22 + sectionDensity * 0.06;
    minimumFadeStart = Math.min(minimumFadeStart, fadeStart);
    maximumFadeStart = Math.max(maximumFadeStart, fadeStart);
    densitySum += density;
  }
  return {
    slices,
    sectionCount,
    fadeStarts,
    densityScales,
    minimumFadeStart,
    maximumFadeStart,
    meanNormalizedDensity: densitySum / slices,
  };
}

export function undercoatCoverageAt(profile, ringFraction, slice) {
  const index = ((slice % profile.slices) + profile.slices) % profile.slices;
  const fraction = Math.max(0, Math.min(1, ringFraction));
  const fadeStart = profile.fadeStarts[index];
  const edgeFade = 1 - smoothStep01((fraction - fadeStart) / Math.max(1e-6, 1 - fadeStart));
  return profile.densityScales[index] * edgeFade;
}

export function physicsSkeletonDepthWriteAt(phase, opacity) {
  return (
    phase === "mechanical_skeleton" || opacity >= PHYSICS_SKELETON_STYLE.depthWriteMinimumOpacity
  );
}

export function presentationLoopOpacityAtStep(
  step,
  { fadeInEndStep = 30, fadeOutStartStep = 990, endStep = 1020 } = {}
) {
  if (!(0 < fadeInEndStep && fadeInEndStep < fadeOutStartStep && fadeOutStartStep < endStep)) {
    throw new Error("presentation loop steps are invalid");
  }
  if (step < fadeInEndStep) return smoothStep01(step / fadeInEndStep);
  if (step < fadeOutStartStep) return 1;
  return 1 - smoothStep01((step - fadeOutStartStep) / (endStep - fadeOutStartStep));
}

export function fullGroomHydrationAtStep(
  step,
  { physicsEndStep = 120, hydrationEndStep = 210, guideFadeEndStep = 240 } = {}
) {
  if (
    !Number.isFinite(step) ||
    !(
      0 < physicsEndStep &&
      physicsEndStep < hydrationEndStep &&
      hydrationEndStep < guideFadeEndStep
    )
  ) {
    throw new Error("full groom hydration steps are invalid");
  }
  if (step < physicsEndStep) {
    return {
      phase: "mechanical_skeleton",
      hairHydration: 0,
      guideOpacity: 0.92,
      tubeOpacity: 0,
    };
  }
  if (step < hydrationEndStep) {
    const progress = smoothStep01((step - physicsEndStep) / (hydrationEndStep - physicsEndStep));
    return {
      phase: "hydrating",
      hairHydration: progress,
      guideOpacity: 0.92 + (0.18 - 0.92) * progress,
      tubeOpacity: 0,
    };
  }
  if (step < guideFadeEndStep) {
    const progress = smoothStep01(
      (step - hydrationEndStep) / (guideFadeEndStep - hydrationEndStep)
    );
    return {
      phase: "guide_release",
      hairHydration: 1,
      guideOpacity: 0.18 * (1 - progress),
      tubeOpacity: 0,
    };
  }
  return { phase: "hydrated", hairHydration: 1, guideOpacity: 0, tubeOpacity: 0 };
}

export function hairFiberColorAt(baseColor, strand, copy, rootFraction, target = {}) {
  const fraction = Math.max(0, Math.min(1, rootFraction));
  const variation = fatlineColorScale(strand, copy);
  const rootToTip = 0.72 + 0.3 * smoothStep01(fraction);
  target.r = Math.min(1, baseColor.r * variation * rootToTip * (1 + 0.08 * fraction));
  target.g = Math.min(1, baseColor.g * variation * rootToTip * (1 + 0.025 * fraction));
  target.b = Math.min(1, baseColor.b * variation * rootToTip * (1 - 0.035 * fraction));
  return target;
}

export function fiberEmergenceScaleAt(strand, copy, particle, activeSegments, rootNormalY = 0) {
  const fraction = Math.max(0, Math.min(1, particle / Math.max(1, activeSegments)));
  if (copy === 0) return smoothStep01(fraction / 0.085);
  let hash = Math.imul(strand + 1, 0x45d9f3b) ^ Math.imul(copy + 1, 0x27d4eb2d);
  hash ^= hash >>> 16;
  const unsigned = hash >>> 0;
  const crown = smoothStep01((rootNormalY - 0.68) / 0.26);
  const start = (0.035 + (unsigned % 7) * 0.011) * (1 - crown * 0.58);
  const end = start + (0.12 + ((unsigned >>> 4) % 5) * 0.012) * (1 - crown * 0.42);
  return smoothStep01((fraction - start) / Math.max(0.001, end - start));
}

export function lockAwareFiberEmergenceScaleAt(
  strand,
  copy,
  particle,
  activeSegments,
  rootNormalY = 0
) {
  const fraction = Math.max(0, Math.min(1, particle / Math.max(1, activeSegments)));
  let hash = Math.imul(strand + 1, 0x45d9f3b) ^ Math.imul(copy + 1, 0x27d4eb2d);
  hash ^= hash >>> 16;
  const unsigned = hash >>> 0;
  const crown = smoothStep01((rootNormalY - 0.68) / 0.26);
  const end =
    copy === 0 ? 0.055 - crown * 0.012 : (0.024 + (unsigned % 7) * 0.004) * (1 - crown * 0.3);
  const rootCoverage = copy === 0 ? 0.08 : 0.16;
  return rootCoverage + (1 - rootCoverage) * smoothStep01(fraction / Math.max(0.001, end));
}

export function reelCameraPoseAtStep(step, shot, loopSteps = 1020) {
  if (!Number.isFinite(step) || !(loopSteps > 0)) throw new Error("reel camera step is invalid");
  if (!["beauty", "control", "cut"].includes(shot)) return null;
  const cycleStep = ((step % loopSteps) + loopSteps) % loopSteps;
  const phase = cycleStep / loopSteps;
  let azimuth;
  let radius;
  let height;
  let targetHeight;
  if (shot === "beauty") {
    azimuth = 0.08 + 0.2 * Math.sin(phase * Math.PI * 2 - 0.5);
    radius = 6.15 - 0.42 * Math.sin(phase * Math.PI);
    height = 1.42 + 0.12 * Math.sin(phase * Math.PI * 2);
    targetHeight = 1.18;
  } else if (shot === "control") {
    azimuth = -0.24;
    radius = 6.35;
    height = 1.72;
    targetHeight = 1.42;
  } else {
    const cutProgress = smoothStep01((cycleStep - 285) / 105);
    azimuth = -0.22 + 0.5 * cutProgress;
    radius = 6.05 - 0.52 * cutProgress;
    height = 1.35 - 0.16 * cutProgress;
    targetHeight = 1.08 - 0.3 * cutProgress;
  }
  return {
    shot,
    cycleStep,
    position: [Math.sin(azimuth) * radius, height, Math.cos(azimuth) * radius],
    target: [0, targetHeight, 0],
  };
}

export function sectionPosePresentationAtStep(step, cycle) {
  if (!cycle) return { phase: "static_control", hydration: 1, tubeOpacity: 0.14 };
  const startStep = cycle.startStep ?? 30;
  const peakStep = cycle.peakStep ?? 90;
  const holdEndStep = cycle.holdEndStep ?? 170;
  const endStep = cycle.endStep ?? 255;
  const authorLeadSteps = Math.max(1, cycle.authorLeadSteps ?? 30);
  const authorStartStep = Math.max(0, startStep - authorLeadSteps);
  const fadeEndStep = Math.min(endStep, cycle.fadeEndStep ?? holdEndStep + 45);
  if (!(authorStartStep <= startStep && startStep < peakStep && peakStep <= holdEndStep)) {
    throw new Error("section pose presentation steps are invalid");
  }
  if (step < authorStartStep) return { phase: "waiting", hydration: 0.08, tubeOpacity: 0 };
  if (step < startStep) {
    return {
      phase: "authoring",
      hydration: 0.08,
      tubeOpacity:
        0.18 * smoothStep01((step - authorStartStep) / Math.max(1, startStep - authorStartStep)),
    };
  }
  if (step < peakStep) {
    const progress = smoothStep01((step - startStep) / (peakStep - startStep));
    return {
      phase: "hydrating",
      hydration: 0.08 + 0.92 * progress,
      tubeOpacity: 0.18 * (1 - 0.7 * progress),
    };
  }
  if (step < holdEndStep) return { phase: "hydrated", hydration: 1, tubeOpacity: 0.055 };
  if (step < fadeEndStep) {
    return {
      phase: "dissolving",
      hydration: 1,
      tubeOpacity: 0.055 * (1 - smoothStep01((step - holdEndStep) / (fadeEndStep - holdEndStep))),
    };
  }
  return { phase: "simulation", hydration: 1, tubeOpacity: 0 };
}

export function fatlineHalfWidthAt(
  particle,
  activeSegments,
  rootWidth = FATLINE_ROOT_HALF_WIDTH_PX,
  tipWidth = FATLINE_TIP_HALF_WIDTH_PX
) {
  const fraction = Math.max(0, Math.min(1, particle / Math.max(1, activeSegments)));
  return rootWidth + (tipWidth - rootWidth) * fraction;
}

export function fatlineColorScale(strand, copy) {
  let hash = Math.imul(strand + 1, 0x45d9f3b) ^ Math.imul(copy + 1, 0x27d4eb2d);
  hash ^= hash >>> 16;
  return 0.9 + ((hash >>> 0) % 21) / 100;
}

export function summarizeGeometryTimings(samples, warmupFrames = 60) {
  const measured = samples.slice(Math.min(warmupFrames, samples.length));
  if (measured.length === 0) {
    return { measured_frames: 0, max_ms: null, p99_ms: null, mean_ms: null };
  }
  const sorted = [...measured].sort((left, right) => left - right);
  const p99Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99) - 1);
  return {
    measured_frames: measured.length,
    max_ms: sorted.at(-1),
    p99_ms: sorted[p99Index],
    mean_ms: measured.reduce((sum, value) => sum + value, 0) / measured.length,
  };
}

export function float32BufferDigest(values, usedLength = values.length) {
  const view = new DataView(new ArrayBuffer(4));
  let hash = 0x811c9dc5;
  for (let index = 0; index < usedLength; index += 1) {
    view.setFloat32(0, values[index], false);
    for (let byte = 0; byte < 4; byte += 1) {
      hash ^= view.getUint8(byte);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
