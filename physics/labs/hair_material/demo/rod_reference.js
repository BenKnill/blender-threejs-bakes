import { digestHairState } from "./replay.js";
import { blendPairAnisotropicFriction, HairSolver } from "./solver.js";

function subtract(left, right) {
  return left.map((value, axis) => value - right[axis]);
}

function magnitude(vector) {
  return Math.hypot(...vector);
}

function normalize(vector) {
  const length = magnitude(vector);
  if (length <= 1e-12) throw new Error("reference direction is degenerate");
  return vector.map((value) => value / length);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function point(solver, guide, particle) {
  const index = solver.index(guide, particle);
  return [solver.positions[index], solver.positions[index + 1], solver.positions[index + 2]];
}

function guideAxis(solver, guide) {
  return normalize(subtract(point(solver, guide, solver.segments), point(solver, guide, 0)));
}

function transverseAxis(axis) {
  const reference = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return normalize(cross(axis, reference));
}

function applyTaperedImpulse(solver, guide, direction, displacementPerStep) {
  for (let particle = 1; particle <= solver.activeSegments[guide]; particle += 1) {
    const weight = particle / solver.segments;
    const index = solver.index(guide, particle);
    for (let axis = 0; axis < 3; axis += 1) {
      solver.previous[index + axis] -= direction[axis] * displacementPerStep * weight;
    }
  }
}

function createGuideSolver() {
  const solver = new HairSolver({
    guideCount: 8,
    segments: 12,
    preset: "straight",
    iterations: 6,
    renderFibersPerGuide: 1,
    collectiveRulesEnabled: false,
  });
  solver.wind = 0;
  return solver;
}

function quantize(value) {
  const rounded = Math.round(value * 1e9) / 1e9;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function quantizeVector(vector) {
  return vector.map(quantize);
}

function runGuideCase(kind, { settlingSteps, steps, dt, displacementPerStep, sampleStride }) {
  const control = createGuideSolver();
  const treatment = createGuideSolver();
  for (let step = 0; step < settlingSteps; step += 1) {
    control.step(dt);
    treatment.step(dt);
  }
  control.beginMeasurementWindow("rod_reference_control");
  treatment.beginMeasurementWindow(`rod_reference_${kind}`);
  const axial = guideAxis(treatment, 0);
  const direction = kind === "axial" ? axial : transverseAxis(axial);
  applyTaperedImpulse(treatment, 0, direction, displacementPerStep);
  const trajectory = [];
  let peakTipDelta = 0;
  const started = performance.now();
  for (let step = 1; step <= steps; step += 1) {
    control.step(dt);
    treatment.step(dt);
    const delta = subtract(
      point(treatment, 0, treatment.segments),
      point(control, 0, control.segments)
    );
    const deltaMagnitude = magnitude(delta);
    peakTipDelta = Math.max(peakTipDelta, deltaMagnitude);
    if (step === 1 || step === steps || step % sampleStride === 0) {
      trajectory.push({
        step,
        delta_from_control: quantizeVector(delta),
        magnitude: quantize(deltaMagnitude),
      });
    }
  }
  const finalDelta = subtract(
    point(treatment, 0, treatment.segments),
    point(control, 0, control.segments)
  );
  return {
    receipt: {
      kind,
      guide_count: treatment.guideCount,
      segments_per_guide: treatment.segments,
      collective_rules_enabled: treatment.collectiveRulesEnabled,
      impulse_direction: quantizeVector(direction),
      initial_tip_displacement_per_step: displacementPerStep,
      settling_steps: settlingSteps,
      peak_tip_delta_from_control: quantize(peakTipDelta),
      final_tip_delta_from_control: quantizeVector(finalDelta),
      control_peak_relative_stretch_error: quantize(control.peakStretchError),
      peak_relative_stretch_error: quantize(treatment.peakStretchError),
      peak_stretch_delta_from_control: quantize(
        treatment.peakStretchError - control.peakStretchError
      ),
      state_digest: digestHairState(treatment),
      trajectory,
    },
    performance: { wall_ms: performance.now() - started },
  };
}

function pairOperatorReceipt() {
  const left = [0.1, -0.04, 0.07];
  const right = [-0.03, 0.08, -0.02];
  const tangent = [1, 0, 0];
  const axialFriction = 0.2;
  const transverseFriction = 0.7;
  const [nextLeft, nextRight] = blendPairAnisotropicFriction(
    left,
    right,
    tangent,
    axialFriction,
    transverseFriction
  );
  const [swappedRight, swappedLeft] = blendPairAnisotropicFriction(
    right,
    left,
    tangent,
    axialFriction,
    transverseFriction
  );
  const relativeBefore = magnitude(subtract(right, left));
  const relativeAfter = magnitude(subtract(nextRight, nextLeft));
  return {
    axial_friction: axialFriction,
    transverse_friction: transverseFriction,
    velocity_sum_residual: quantizeVector(
      nextLeft.map((value, axis) => value + nextRight[axis] - left[axis] - right[axis])
    ),
    swap_symmetry_residual: quantizeVector([
      ...nextLeft.map((value, axis) => value - swappedLeft[axis]),
      ...nextRight.map((value, axis) => value - swappedRight[axis]),
    ]),
    relative_speed_before: quantize(relativeBefore),
    relative_speed_after: quantize(relativeAfter),
    contraction_ratio: quantize(relativeAfter / relativeBefore),
  };
}

export function runHairRodReference({
  settlingSteps = 120,
  steps = 120,
  dt = 1 / 60,
  displacementPerStep = 0.004,
  sampleStride = 10,
} = {}) {
  if (
    !Number.isInteger(settlingSteps) ||
    settlingSteps < 0 ||
    !Number.isInteger(steps) ||
    steps < 1
  ) {
    throw new Error("settling and measurement steps must be nonnegative integers");
  }
  if (!(dt > 0) || !(displacementPerStep > 0) || !Number.isInteger(sampleStride)) {
    throw new Error("invalid rod reference scale");
  }
  const axial = runGuideCase("axial", {
    settlingSteps,
    steps,
    dt,
    displacementPerStep,
    sampleStride,
  });
  const transverse = runGuideCase("transverse", {
    settlingSteps,
    steps,
    dt,
    displacementPerStep,
    sampleStride,
  });
  return {
    receipt: {
      schema: "hair-rod-reference/1",
      boundary:
        "eight independent clamped PBD guides and one direct pair-operator card; proxy scales are not calibrated rod forces",
      steps,
      settling_steps: settlingSteps,
      dt,
      axial: axial.receipt,
      transverse: transverse.receipt,
      pair_operator: pairOperatorReceipt(),
    },
    performance: {
      axial_wall_ms: axial.performance.wall_ms,
      transverse_wall_ms: transverse.performance.wall_ms,
    },
  };
}
