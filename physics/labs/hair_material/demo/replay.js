import { HairSolver } from "./solver.js?v=106";

export const COMB_MATERIAL_CONDITIONS = Object.freeze({
  dry: Object.freeze({ label: "Dry", moisture: 0.05, product: 0 }),
  wet: Object.freeze({ label: "Wet", moisture: 0.85, product: 0 }),
  product: Object.freeze({ label: "Product-heavy", moisture: 0.35, product: 0.85 }),
});

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;
export const DIGEST_QUANTIZATION = 1e-6;

function mixByte(hash, byte) {
  return ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK_64;
}

function mixNumber(hash, value, view) {
  const quantized = Math.round(value / DIGEST_QUANTIZATION) * DIGEST_QUANTIZATION;
  view.setFloat64(0, Object.is(quantized, -0) ? 0 : quantized, false);
  for (let index = 0; index < 8; index += 1) hash = mixByte(hash, view.getUint8(index));
  return hash;
}

export function digestHairState(solver) {
  const view = new DataView(new ArrayBuffer(8));
  let hash = FNV_OFFSET;
  for (const value of solver.positions) hash = mixNumber(hash, value, view);
  for (const value of solver.previous) hash = mixNumber(hash, value, view);
  for (const value of solver.activeSegments) hash = mixNumber(hash, value, view);
  hash = mixNumber(hash, solver.cutCount, view);
  hash = mixNumber(hash, solver.time, view);
  for (const key of Array.from(solver.clumpBonds).sort()) {
    for (let index = 0; index < key.length; index += 1) hash = mixByte(hash, key.charCodeAt(index));
    hash = mixByte(hash, 0xff);
  }
  return hash.toString(16).padStart(16, "0");
}

export function summarizeCombReceipt(receipt) {
  const trace = receipt.comb.force_displacement_trace;
  const travel = Math.max(receipt.comb.accumulated_travel, Number.EPSILON);
  const bands = [0, 0, 0];
  let reactionTotal = 0;
  let weightedDisplacement = 0;
  let peak = null;
  for (const sample of trace) {
    const reaction = Math.max(0, sample.reaction_proxy);
    const fraction = Math.max(0, Math.min(1, sample.displacement / travel));
    reactionTotal += reaction;
    weightedDisplacement += reaction * fraction;
    bands[Math.min(2, Math.floor(fraction * 3))] += reaction;
    if (!peak || reaction > peak.reaction_proxy) peak = sample;
  }
  return {
    peak_reaction_proxy: receipt.comb.peak_reaction_proxy,
    accumulated_work_proxy: receipt.comb.accumulated_work_proxy,
    clump_captures: receipt.comb.clump_captures_during_window,
    clump_releases: receipt.comb.clump_releases_during_window,
    persistent_clump_bonds: receipt.persistent_clump_bonds,
    maximum_clump_age_steps: receipt.persistent_contact_memory.maximum_age_steps,
    maximum_service_gap_steps: receipt.contact_service.maximum_observed_gap_steps,
    peak_relative_stretch_error: receipt.peak_relative_stretch_error,
    assumption_status: receipt.assumption_receipt.status,
    trace_shape: {
      sample_count: trace.length,
      peak_position: peak?.x ?? null,
      reaction_centroid_fraction: reactionTotal > 0 ? weightedDisplacement / reactionTotal : null,
      reaction_fraction_by_travel_third:
        reactionTotal > 0 ? bands.map((value) => value / reactionTotal) : [0, 0, 0],
    },
  };
}

export function createReplayState() {
  return { step: 0, cutStrands: new Set() };
}

function applyDiagonalCut(solver, config, elapsed, state) {
  if (elapsed < config.cutAt) return;
  const progress = Math.min(1, (elapsed - config.cutAt) / config.cutDuration);
  const sweepX = -0.92 + progress * 1.84;
  for (let strand = 0; strand < solver.guideCount; strand += 1) {
    if (state.cutStrands.has(strand)) continue;
    const rootX = solver.roots[strand * 3];
    if (rootX > sweepX) continue;
    const normalizedX = Math.max(0, Math.min(1, (rootX + 0.92) / 1.84));
    const segment = Math.round(solver.segments * (0.78 - normalizedX * 0.38));
    solver.cutStrand(strand, segment);
    state.cutStrands.add(strand);
  }
}

function applyCombPass(solver, config, state) {
  const comb = config.comb;
  const finalStep = comb?.returnEndStep ?? comb?.endStep;
  if (!comb || state.step > finalStep) {
    solver.disableComb();
    return;
  }
  if (state.step < comb.startStep) {
    solver.prepareMeasurementWindow("comb_settling");
    solver.disableComb();
    return;
  }
  if (state.step === comb.startStep) {
    solver.beginMeasurementWindow(comb.returnEndStep ? "comb_cycle" : "comb_pass");
  }
  const startX = comb.startX ?? -1.35;
  const endX = comb.endX ?? 1.35;
  let phase = "forward";
  let phaseStart = comb.startStep;
  let phaseEnd = comb.endStep;
  let fromX = startX;
  let toX = endX;
  if (state.step > comb.endStep) {
    if (!comb.returnStartStep || state.step < comb.returnStartStep) {
      solver.disableComb();
      return;
    }
    phase = "return";
    phaseStart = comb.returnStartStep;
    phaseEnd = comb.returnEndStep;
    fromX = endX;
    toX = comb.returnX ?? startX;
  }
  const span = Math.max(1, phaseEnd - phaseStart);
  const progress = Math.min(1, Math.max(0, (state.step - phaseStart) / span));
  const priorProgress = Math.min(1, Math.max(0, (state.step - 1 - phaseStart) / span));
  const currentX = fromX + (toX - fromX) * progress;
  const previousX = fromX + (toX - fromX) * priorProgress;
  solver.setCombPose(previousX, currentX, { ...comb.envelope, phase });
}

export function advanceHairReplay(solver, config, state, targetStep) {
  if (!Number.isInteger(targetStep) || targetStep < state.step) {
    throw new Error("replay target step must be an integer at or after the current step");
  }
  const dt = config.dt ?? 1 / 60;
  while (state.step < targetStep) {
    const elapsed = state.step * dt;
    const gustWave = 0.5 + 0.5 * Math.sin(elapsed * 2.4 - Math.PI * 0.5);
    solver.wind = (config.baseWind ?? 0.18) + (config.gust ?? 0) * gustWave;
    if (config.windRotationRate || config.windAngle !== undefined) {
      solver.setWindDirection((config.windAngle ?? 0) + elapsed * (config.windRotationRate ?? 0));
    }
    if (config.cut === "diagonal") applyDiagonalCut(solver, config, elapsed, state);
    applyCombPass(solver, config, state);
    solver.step(dt);
    state.step += 1;
  }
  return {
    step: state.step,
    simulation_seconds: state.step * dt,
    state_digest: digestHairState(solver),
    receipt: solver.receipt(),
  };
}

export function runHairReplay({
  solver: solverOptions = {},
  steps = 180,
  moisture = 0,
  product = 0,
  sectionLift = 0,
  ...config
} = {}) {
  const solver = new HairSolver(solverOptions);
  solver.setMoisture(moisture);
  solver.setProduct(product);
  solver.setSectionLift(sectionLift);
  const state = createReplayState();
  return { solver, state, result: advanceHairReplay(solver, config, state, steps) };
}
