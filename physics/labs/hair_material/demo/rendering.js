export const FATLINE_ROOT_HALF_WIDTH_PX = 1.22;
export const FATLINE_TIP_HALF_WIDTH_PX = 0.2;
export const HAIR_FIBER_SHADING_ID = "tangent_dual_lobe_ms_fill_v1";
export const HAIR_PRESENTATION_LOOP_ID = "fade_reset_450_step_v1";
export const REEL_CAMERA_FIELD_ID = "three_shot_orbit_450_step_v1";

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function presentationLoopOpacityAtStep(
  step,
  { fadeInEndStep = 30, fadeOutStartStep = 420, endStep = 450 } = {}
) {
  if (!(0 < fadeInEndStep && fadeInEndStep < fadeOutStartStep && fadeOutStartStep < endStep)) {
    throw new Error("presentation loop steps are invalid");
  }
  if (step < fadeInEndStep) return smoothStep01(step / fadeInEndStep);
  if (step < fadeOutStartStep) return 1;
  return 1 - smoothStep01((step - fadeOutStartStep) / (endStep - fadeOutStartStep));
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

export function reelCameraPoseAtStep(step, shot, loopSteps = 450) {
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
    azimuth = -0.24 + 0.14 * Math.sin(phase * Math.PI * 2);
    radius = 6.35;
    height = 1.72 + 0.08 * Math.sin(phase * Math.PI * 2);
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
