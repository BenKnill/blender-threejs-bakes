import { blendPairAnisotropicFriction } from "./friction.js";
import {
  createSpatialFrictionState,
  resetSpatialFrictionState,
  resetSpatialFrictionWindow,
  spatialFrictionReceipt,
  stepSpatialFriction,
} from "./spatial_friction.js";
import {
  bakeRootDirectorTarget,
  projectRootDirectorPoint,
  ROOT_DIRECTOR_DEFAULT_STRENGTH,
  ROOT_DIRECTOR_FALLOFF,
  ROOT_DIRECTOR_NORMAL_BIASES,
  ROOT_DIRECTOR_STYLED_BIASES,
  ROOT_DIRECTOR_ZONE_SEGMENTS,
  summarizeRootAlignment,
  summarizeRootTargetAlignment,
} from "./root_director.js";
import {
  bakeStyledRootDirection,
  ROOT_STYLE_FIELD_ID,
  ROOT_STYLE_PART_X,
  ROOT_STYLE_SECTION_COUNT,
  summarizeRootTargets,
} from "./root_style_field.js?v=115";
import { groomSectionId } from "./groom_interpolation.js";
import {
  scalpRootFrame,
  SCALP_CENTER,
  SCALP_LAYOUT_ID,
  SCALP_RADII,
  summarizeScalpLayout,
} from "./scalp_layout.js?v=115";

export { blendPairAnisotropicFriction } from "./friction.js";

export const MATERIAL_PRESETS = Object.freeze({
  straight: Object.freeze({
    label: "Straight / fine",
    length: 2.7,
    curlRadius: 0.018,
    curlTurns: 0.35,
    bendStiffness: 0.12,
    damping: 0.935,
    drag: 0.06,
    friction: 0.22,
    clump: 0.08,
  }),
  wavy: Object.freeze({
    label: "Wavy / medium",
    length: 2.55,
    curlRadius: 0.13,
    curlTurns: 1.35,
    bendStiffness: 0.2,
    damping: 0.925,
    drag: 0.075,
    friction: 0.36,
    clump: 0.18,
  }),
  curly: Object.freeze({
    label: "Curly / springy",
    length: 2.15,
    curlRadius: 0.24,
    curlTurns: 2.65,
    bendStiffness: 0.34,
    damping: 0.91,
    drag: 0.095,
    friction: 0.5,
    clump: 0.28,
  }),
  coily: Object.freeze({
    label: "Coily / high recovery",
    length: 1.55,
    curlRadius: 0.29,
    curlTurns: 5.2,
    bendStiffness: 0.52,
    damping: 0.89,
    drag: 0.12,
    friction: 0.62,
    clump: 0.38,
  }),
});

const ROOT_DIRECTOR_MODES = new Set(["free", "scalp_normal", "styled_side_part"]);
const SECTION_LIFT_STEP_STRENGTH = 0.18;
const SECTION_POSE_FIELD_ID = "eight_section_tangent_tube_v1";
const SECTION_POSE_STEP_STRENGTH = 0.12;
const SECTION_POSE_CONTROL_FRACTIONS = Object.freeze([0.36, 0.5, 0.64]);
const SECTION_POSE_CONTROL_WEIGHTS = Object.freeze([0.55, 1, 0.62]);
const FACE_CLEAR_GROOM_ID = "front_midshaft_rest_projection_v1";
const FACE_CLEAR_STEP_STRENGTH = 0.12;

function length3(x, y, z) {
  return Math.hypot(x, y, z);
}

function normalize3(x, y, z) {
  const length = length3(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

export function projectPair(
  positionA,
  positionB,
  inverseMassA,
  inverseMassB,
  restLength,
  stiffness = 1
) {
  const dx = positionB[0] - positionA[0];
  const dy = positionB[1] - positionA[1];
  const dz = positionB[2] - positionA[2];
  const distance = length3(dx, dy, dz);
  const denominator = inverseMassA + inverseMassB;
  const beforeError = distance - restLength;
  if (distance < 1e-12 || denominator <= 0) {
    return {
      correctionA: [0, 0, 0],
      correctionB: [0, 0, 0],
      beforeError,
      afterError: beforeError,
    };
  }
  const scale = (stiffness * beforeError) / (distance * denominator);
  const correctionA = [
    inverseMassA * scale * dx,
    inverseMassA * scale * dy,
    inverseMassA * scale * dz,
  ];
  const correctionB = [
    -inverseMassB * scale * dx,
    -inverseMassB * scale * dy,
    -inverseMassB * scale * dz,
  ];
  const afterA = positionA.map((value, axis) => value + correctionA[axis]);
  const afterB = positionB.map((value, axis) => value + correctionB[axis]);
  return {
    correctionA,
    correctionB,
    beforeError,
    afterError:
      length3(afterB[0] - afterA[0], afterB[1] - afterA[1], afterB[2] - afterA[2]) - restLength,
  };
}

export function blendPairFriction(velocityA, velocityB, friction) {
  const blend = Math.max(0, Math.min(1, friction));
  const nextA = [];
  const nextB = [];
  for (let axis = 0; axis < 3; axis += 1) {
    const mean = (velocityA[axis] + velocityB[axis]) * 0.5;
    nextA.push(velocityA[axis] + (mean - velocityA[axis]) * blend);
    nextB.push(velocityB[axis] + (mean - velocityB[axis]) * blend);
  }
  return [nextA, nextB];
}

export function updateClumpBond(bonded, distance, captureRadius, releaseRadius) {
  if (releaseRadius <= captureRadius) throw new Error("release radius must exceed capture radius");
  return bonded ? distance < releaseRadius : distance < captureRadius;
}

export function projectPressurePair(
  positionA,
  positionB,
  minimumGap,
  strength,
  maxCorrection = 0.01
) {
  const delta = positionB.map((value, axis) => value - positionA[axis]);
  const distance = length3(...delta);
  if (distance >= minimumGap || distance < 1e-12) {
    return { active: false, correctionA: [0, 0, 0], correctionB: [0, 0, 0] };
  }
  const scale = Math.min(maxCorrection, (minimumGap - distance) * strength) / distance;
  const correctionA = delta.map((value) => -value * scale);
  return { active: true, correctionA, correctionB: correctionA.map((value) => -value) };
}

export function projectCohesionPair(
  positionA,
  positionB,
  targetGap,
  contactRadius,
  strength,
  maxCorrection = 0.012
) {
  const delta = positionB.map((value, axis) => value - positionA[axis]);
  const distance = length3(...delta);
  if (distance <= targetGap || distance >= contactRadius || distance < 1e-12) {
    return { active: false, correctionA: [0, 0, 0], correctionB: [0, 0, 0] };
  }
  const scale = Math.min(maxCorrection, (distance - targetGap) * strength) / distance;
  const correctionA = delta.map((value) => value * scale);
  return { active: true, correctionA, correctionB: correctionA.map((value) => -value) };
}

export function projectCombSweep(position, previousX, currentX, clearance = 0.006) {
  const direction = Math.sign(currentX - previousX);
  if (direction === 0) return { active: false, correction: [0, 0, 0] };
  const targetX = currentX + direction * clearance;
  const caught =
    direction > 0
      ? position[0] >= previousX - clearance && position[0] < targetX
      : position[0] <= previousX + clearance && position[0] > targetX;
  if (!caught) return { active: false, correction: [0, 0, 0] };
  return { active: true, correction: [targetX - position[0], 0, 0] };
}

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function restPoint(frame, material, segment, segments, styled) {
  if (segment === 0) return frame.root;
  const s = segment / segments;
  const angle = s * material.curlTurns * Math.PI * 2 + frame.phi;
  const baseCos = Math.cos(frame.phi);
  const baseSin = Math.sin(frame.phi);
  const curlU = material.curlRadius * (Math.cos(angle) - baseCos);
  const curlV = material.curlRadius * (Math.sin(angle) - baseSin);
  const lift = 0.16 * Math.sin(Math.min(1, s * 3) * Math.PI * 0.5);
  const front = Math.max(0, frame.normal[2]);
  const center = 1 - Math.min(1, Math.abs(frame.normal[0]) / 0.82);
  const faceClear = styled ? front * center : 0;
  const partSide = frame.root[0] < ROOT_STYLE_PART_X ? -1 : 1;
  const faceEnvelope = smoothStep01((s - 0.055) / 0.38);
  const returnEnvelope = 1 - 0.34 * smoothStep01((s - 0.62) / 0.38);
  const lateralClear = partSide * faceClear * 0.44 * faceEnvelope * returnEnvelope;
  const rearClear = -faceClear * 0.28 * faceEnvelope * returnEnvelope;
  const crown = smoothStep01((frame.normal[1] - 0.68) / 0.28);
  const crownFlow = -crown * 0.24 * faceEnvelope * returnEnvelope;
  const crownLift = styled ? crown * 0.11 * Math.sin(Math.min(1, s * 1.8) * Math.PI) : 0;
  return [
    frame.root[0] +
      frame.normal[0] * lift +
      frame.tangent[0] * curlU +
      frame.bitangent[0] * curlV +
      lateralClear,
    frame.root[1] +
      frame.normal[1] * lift -
      material.length * s +
      frame.tangent[1] * curlU +
      frame.bitangent[1] * curlV +
      crownLift,
    frame.root[2] +
      frame.normal[2] * lift +
      frame.tangent[2] * curlU +
      frame.bitangent[2] * curlV +
      rearClear +
      crownFlow,
  ];
}

export class HairSolver {
  constructor({
    guideCount = 512,
    segments = 12,
    preset = "wavy",
    iterations = 5,
    renderFibersPerGuide = 9,
    collectiveRulesEnabled = true,
    spatialFrictionEnabled = false,
    spatialFrictionRefreshSteps = 8,
    spatialFrictionScale = 0.5,
    rootDirectorEnabled = false,
    rootDirectorMode,
    rootDirectorStrength = ROOT_DIRECTOR_DEFAULT_STRENGTH,
    faceClearGroomEnabled,
  } = {}) {
    if (!(preset in MATERIAL_PRESETS)) throw new Error(`unknown material preset: ${preset}`);
    if (guideCount < 8 || segments < 4) throw new Error("hair solver resolution is too small");
    this.guideCount = guideCount;
    this.segments = segments;
    this.particlesPerGuide = segments + 1;
    this.iterations = iterations;
    this.renderFibersPerGuide = Math.max(1, Math.floor(renderFibersPerGuide));
    this.collectiveRulesEnabled = Boolean(collectiveRulesEnabled);
    this.spatialFriction = createSpatialFrictionState({
      enabled: spatialFrictionEnabled,
      refreshPeriodSteps: spatialFrictionRefreshSteps,
      scale: spatialFrictionScale,
    });
    this.preset = preset;
    this.material = { ...MATERIAL_PRESETS[preset] };
    this.particleCount = guideCount * this.particlesPerGuide;
    this.positions = new Float64Array(this.particleCount * 3);
    this.previous = new Float64Array(this.particleCount * 3);
    this.rest = new Float64Array(this.particleCount * 3);
    this.roots = new Float64Array(guideCount * 3);
    this.rootNormals = new Float64Array(guideCount * 3);
    this.rootDirectorTargets = new Float64Array(guideCount * ROOT_DIRECTOR_ZONE_SEGMENTS * 3);
    this.rootDirectorProjection = new Float64Array(6);
    this.rootStyleProjection = new Float64Array(6);
    this.guideSections = new Uint8Array(guideCount);
    this.activeSegments = new Uint16Array(guideCount);
    this.restLengths = new Float64Array(guideCount * segments);
    this.cutCount = 0;
    this.time = 0;
    this.wind = 0.18;
    this.windDirection = [1, 0, 0.45];
    this.windAngle = Math.atan2(0.45, 1);
    this.directionalWind = false;
    this.sectionLift = 0;
    this.sectionLiftPhase = "static";
    this.sectionLiftCorrections = 0;
    this.sectionLiftCorrectionDistance = 0;
    this.sectionPose = {
      section: -1,
      lift: 0,
      sweep: 0,
      phase: "off",
      affectedGuideCount: 0,
      activeGuideCountLastStep: 0,
      correctionsLastStep: 0,
      correctionDistanceLastStep: 0,
    };
    const resolvedRootDirectorMode =
      rootDirectorMode ?? (rootDirectorEnabled ? "scalp_normal" : "free");
    if (!ROOT_DIRECTOR_MODES.has(resolvedRootDirectorMode)) {
      throw new Error(`unknown root director mode: ${resolvedRootDirectorMode}`);
    }
    this.rootDirector = {
      enabled: resolvedRootDirectorMode !== "free",
      mode: resolvedRootDirectorMode,
      strength: Math.max(0, Math.min(1, rootDirectorStrength)),
      zoneSegments: ROOT_DIRECTOR_ZONE_SEGMENTS,
      falloff: ROOT_DIRECTOR_FALLOFF,
      normalBiases: [...ROOT_DIRECTOR_NORMAL_BIASES],
      correctionsLastStep: 0,
      correctionDistanceLastStep: 0,
      minimumNormalDot: 0,
      meanNormalDot: 0,
      minimumTargetDot: 0,
      meanTargetDot: 0,
      minimumTargetOutwardDot: 0,
      meanTargetOutwardDot: 0,
      meanTargetTangentialMagnitude: 0,
    };
    this.faceClearGroom = {
      enabled: resolvedRootDirectorMode === "styled_side_part" && faceClearGroomEnabled !== false,
      affectedGuideCount: 0,
      activeGuideCountLastStep: 0,
      correctionsLastStep: 0,
      correctionDistanceLastStep: 0,
    };
    this.maxStretchError = 0;
    this.moisture = 0;
    this.product = 0;
    this.activeNeighborContacts = 0;
    this.cohesionCorrections = 0;
    this.pressureCorrections = 0;
    this.clumpBonds = new Set();
    this.clumpBondAges = new Map();
    this.contactLastServiced = new Map();
    this.simulationStep = 0;
    this.contactServicesLastStep = 0;
    this.windowContactServices = 0;
    this.maxContactServiceGap = 0;
    this.clumpCaptures = 0;
    this.clumpReleases = 0;
    this.windowClumpCaptures = 0;
    this.windowClumpReleases = 0;
    this.stretchThreshold = 0.035;
    this.stretchCorrectionPasses = 0;
    this.peakStretchError = 0;
    this.comb = {
      enabled: false,
      previousX: -1.35,
      currentX: -1.35,
      yMin: -0.7,
      yMax: 1.45,
      zMin: 0.12,
      zMax: 1.2,
      clearance: 0.006,
      phase: "idle",
    };
    this.combContacts = 0;
    this.combReaction = 0;
    this.combPeakReaction = 0;
    this.combWork = 0;
    this.combForwardWork = 0;
    this.combReturnWork = 0;
    this.combTravel = 0;
    this.combTrace = [];
    this.combTraceStride = 1;
    this.combMeasurementStep = 0;
    this.measurementWindow = "full_simulation";
    this.#initialize();
    this.#updateRootAlignment();
    this.neighborPairs = this.#buildNeighborPairs(3);
  }

  index(strand, particle, axis = 0) {
    return (strand * this.particlesPerGuide + particle) * 3 + axis;
  }

  #initialize() {
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      const frame = scalpRootFrame(strand, this.guideCount);
      this.activeSegments[strand] = this.segments;
      for (let axis = 0; axis < 3; axis += 1) {
        this.roots[strand * 3 + axis] = frame.root[axis];
        this.rootNormals[strand * 3 + axis] = frame.normal[axis];
      }
      this.guideSections[strand] = groomSectionId(
        frame.root[0],
        frame.root[2],
        ROOT_STYLE_SECTION_COUNT
      );
      for (let particle = 0; particle <= this.segments; particle += 1) {
        const point = restPoint(
          frame,
          this.material,
          particle,
          this.segments,
          this.rootDirector.mode === "styled_side_part"
        );
        for (let axis = 0; axis < 3; axis += 1) {
          const index = this.index(strand, particle, axis);
          this.positions[index] = point[axis];
          this.previous[index] = point[axis];
          this.rest[index] = point[axis];
        }
        if (particle > 0) {
          const prior = this.index(strand, particle - 1);
          const current = this.index(strand, particle);
          this.restLengths[strand * this.segments + particle - 1] = length3(
            this.rest[current] - this.rest[prior],
            this.rest[current + 1] - this.rest[prior + 1],
            this.rest[current + 2] - this.rest[prior + 2]
          );
        }
      }
      for (
        let segment = 0;
        segment < Math.min(ROOT_DIRECTOR_ZONE_SEGMENTS, this.segments);
        segment += 1
      ) {
        const prior = this.index(strand, segment);
        const next = this.index(strand, segment + 1);
        const styled = this.rootDirector.mode === "styled_side_part";
        const field = styled
          ? bakeStyledRootDirection(
              frame.root[0],
              frame.root[1],
              frame.root[2],
              frame.normal[0],
              frame.normal[1],
              frame.normal[2],
              this.rootStyleProjection
            )
          : frame.normal;
        bakeRootDirectorTarget(
          field[0],
          field[1],
          field[2],
          this.rest[next] - this.rest[prior],
          this.rest[next + 1] - this.rest[prior + 1],
          this.rest[next + 2] - this.rest[prior + 2],
          (styled ? ROOT_DIRECTOR_STYLED_BIASES : ROOT_DIRECTOR_NORMAL_BIASES)[segment],
          this.rootDirectorProjection
        );
        const target = (strand * ROOT_DIRECTOR_ZONE_SEGMENTS + segment) * 3;
        for (let axis = 0; axis < 3; axis += 1) {
          this.rootDirectorTargets[target + axis] = this.rootDirectorProjection[axis];
        }
      }
    }
    const targetSummary = summarizeRootTargets(
      this.rootDirectorTargets,
      this.rootNormals,
      this.rootDirector.zoneSegments
    );
    this.rootDirector.minimumTargetOutwardDot = targetSummary.minimumOutwardDot;
    this.rootDirector.meanTargetOutwardDot = targetSummary.meanOutwardDot;
    this.rootDirector.meanTargetTangentialMagnitude = targetSummary.meanTangentialMagnitude;
    this.scalpLayout = summarizeScalpLayout(this.rootNormals);
  }

  reset(preset = this.preset) {
    if (!(preset in MATERIAL_PRESETS)) throw new Error(`unknown material preset: ${preset}`);
    this.preset = preset;
    this.material = { ...MATERIAL_PRESETS[preset] };
    this.cutCount = 0;
    this.time = 0;
    this.simulationStep = 0;
    this.windDirection = [1, 0, 0.45];
    this.windAngle = Math.atan2(0.45, 1);
    this.directionalWind = false;
    this.clumpBonds.clear();
    this.clumpBondAges.clear();
    this.contactLastServiced.clear();
    resetSpatialFrictionState(this.spatialFriction);
    this.contactServicesLastStep = 0;
    this.windowContactServices = 0;
    this.maxContactServiceGap = 0;
    resetSpatialFrictionWindow(this.spatialFriction);
    this.clumpCaptures = 0;
    this.clumpReleases = 0;
    this.windowClumpCaptures = 0;
    this.windowClumpReleases = 0;
    this.peakStretchError = 0;
    this.combContacts = 0;
    this.combReaction = 0;
    this.combPeakReaction = 0;
    this.combWork = 0;
    this.combForwardWork = 0;
    this.combReturnWork = 0;
    this.combTravel = 0;
    this.combTrace = [];
    this.combTraceStride = 1;
    this.combMeasurementStep = 0;
    this.measurementWindow = "full_simulation";
    this.comb.enabled = false;
    this.#initialize();
    this.#updateRootAlignment();
    this.#refreshMaterial();
  }

  setMoisture(value) {
    this.moisture = Math.max(0, Math.min(1, value));
    this.#refreshMaterial();
  }

  setProduct(value) {
    this.product = Math.max(0, Math.min(1, value));
    this.#refreshMaterial();
  }

  #refreshMaterial() {
    const base = MATERIAL_PRESETS[this.preset];
    this.material = {
      ...base,
      bendStiffness: Math.min(
        0.92,
        base.bendStiffness * (1 - 0.28 * this.moisture) + 0.34 * this.product
      ),
      damping: base.damping - 0.035 * this.moisture - 0.055 * this.product,
      drag: base.drag + 0.16 * this.moisture,
      friction: Math.min(0.94, base.friction + 0.28 * this.moisture + 0.32 * this.product),
      clump: Math.min(0.82, base.clump + 0.34 * this.moisture + 0.42 * this.product),
      moisture: this.moisture,
      product: this.product,
    };
  }

  setSectionLift(value, phase = "static") {
    this.sectionLift = Math.max(0, Math.min(1.4, value));
    this.sectionLiftPhase = phase;
  }

  setSectionPose({ section = -1, lift = 0, sweep = 0, phase = "static" } = {}) {
    const resolvedSection = Number.isInteger(section)
      ? Math.max(-1, Math.min(ROOT_STYLE_SECTION_COUNT - 1, section))
      : -1;
    this.sectionPose.section = resolvedSection;
    this.sectionPose.lift = Math.max(0, Math.min(1.4, lift));
    const resolvedSweep = Math.max(-1.4, Math.min(1.4, sweep));
    this.sectionPose.sweep = Object.is(resolvedSweep, -0) ? 0 : resolvedSweep;
    this.sectionPose.phase = resolvedSection < 0 ? "off" : phase;
    let affectedGuideCount = 0;
    if (resolvedSection >= 0) {
      for (const guideSection of this.guideSections) {
        if (guideSection === resolvedSection) affectedGuideCount += 1;
      }
    }
    this.sectionPose.affectedGuideCount = affectedGuideCount;
  }

  setWindDirection(angle) {
    this.windAngle = angle;
    this.windDirection = [Math.cos(angle), 0, Math.sin(angle)];
    this.directionalWind = true;
  }

  disableDirectionalWind() {
    this.directionalWind = false;
    this.windDirection = [1, 0, 0.45];
    this.windAngle = Math.atan2(0.45, 1);
  }

  setCombPose(previousX, currentX, envelope = {}) {
    Object.assign(this.comb, envelope, { enabled: true, previousX, currentX });
  }

  disableComb() {
    this.comb.enabled = false;
    this.combContacts = 0;
    this.combReaction = 0;
  }

  beginMeasurementWindow(name) {
    this.measurementWindow = name;
    this.peakStretchError = 0;
    this.combContacts = 0;
    this.combReaction = 0;
    this.combPeakReaction = 0;
    this.combWork = 0;
    this.combForwardWork = 0;
    this.combReturnWork = 0;
    this.combTravel = 0;
    this.combTrace = [];
    this.combTraceStride = 1;
    this.combMeasurementStep = 0;
    this.windowContactServices = 0;
    this.maxContactServiceGap = 0;
    resetSpatialFrictionWindow(this.spatialFriction);
  }

  prepareMeasurementWindow(name) {
    this.measurementWindow = name;
  }

  cutStrand(strand, segment) {
    if (strand < 0 || strand >= this.guideCount) return false;
    const next = Math.max(1, Math.min(this.activeSegments[strand], Math.floor(segment)));
    if (next >= this.activeSegments[strand]) return false;
    this.activeSegments[strand] = next;
    for (const key of this.clumpBonds) {
      const [pairIndex, particle] = key.split(":").map(Number);
      if (particle <= next) continue;
      if (this.neighborPairs[pairIndex].includes(strand)) {
        this.clumpBonds.delete(key);
        this.clumpBondAges.delete(key);
      }
    }
    for (const key of this.contactLastServiced.keys()) {
      const [pairIndex, particle] = key.split(":").map(Number);
      if (particle > next && this.neighborPairs[pairIndex].includes(strand)) {
        this.contactLastServiced.delete(key);
      }
    }
    this.cutCount += 1;
    return true;
  }

  step(dt = 1 / 60) {
    const step = Math.max(1 / 240, Math.min(1 / 30, dt));
    this.time += step;
    this.simulationStep += 1;
    this.rootDirector.correctionsLastStep = 0;
    this.rootDirector.correctionDistanceLastStep = 0;
    this.sectionLiftCorrections = 0;
    this.sectionLiftCorrectionDistance = 0;
    this.sectionPose.activeGuideCountLastStep = 0;
    this.sectionPose.correctionsLastStep = 0;
    this.sectionPose.correctionDistanceLastStep = 0;
    this.faceClearGroom.activeGuideCountLastStep = 0;
    this.faceClearGroom.correctionsLastStep = 0;
    this.faceClearGroom.correctionDistanceLastStep = 0;
    const damping = this.material.damping;
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      for (let particle = 1; particle <= this.activeSegments[strand]; particle += 1) {
        const base = this.index(strand, particle);
        const x = this.positions[base];
        const y = this.positions[base + 1];
        const z = this.positions[base + 2];
        const tipWeight = particle / this.segments;
        const localWave = Math.sin(this.time * 1.7 + strand * 0.071);
        const wind =
          this.wind * (this.directionalWind ? 0.72 + 0.28 * localWave : localWave) * tipWeight;
        this.positions[base] +=
          (x - this.previous[base]) * damping + wind * this.windDirection[0] * step * step;
        this.positions[base + 1] += (y - this.previous[base + 1]) * damping - 9.81 * step * step;
        this.positions[base + 2] +=
          (z - this.previous[base + 2]) * damping + wind * this.windDirection[2] * step * step;
        this.previous[base] = x;
        this.previous[base + 1] = y;
        this.previous[base + 2] = z;
      }
    }
    this.#projectComb(step);
    if (this.collectiveRulesEnabled) {
      this.#applyNeighborFriction();
      stepSpatialFriction(this, this.spatialFriction);
      this.#updateClumpBonds();
    } else {
      this.activeNeighborContacts = 0;
      this.spatialFriction.active_contacts_last_step = 0;
      this.spatialFriction.stale_rejects_last_step = 0;
      this.spatialFriction.friction_impulse_proxy_last_step = 0;
      this.clumpCaptures = 0;
      this.clumpReleases = 0;
      this.contactServicesLastStep = 0;
    }
    for (let iteration = 0; iteration < this.iterations; iteration += 1) {
      this.#projectLengths();
      this.#projectRestCurvature();
      if (this.collectiveRulesEnabled) this.#projectCollectivePairs();
      this.#projectSectionLift();
      this.#projectSectionPose();
      this.#projectFaceClearGroom();
      this.#projectScalp();
      if (this.rootDirector.enabled) {
        this.#projectRootDirector();
        this.#projectScalp();
      }
      this.#pinRoots();
    }
    // Curvature and collision projections can reintroduce small length errors.
    // Finish with inexpensive length passes so the public telemetry reports the
    // state that is actually rendered, not the midpoint of the solve.
    for (let iteration = 0; iteration < 3; iteration += 1) {
      this.#projectLengths();
      this.#projectScalp();
      this.#pinRoots();
    }
    this.maxStretchError = this.measureMaxStretchError();
    this.stretchCorrectionPasses = 3;
    while (this.maxStretchError > this.stretchThreshold && this.stretchCorrectionPasses < 24) {
      this.#projectLengths();
      this.#projectScalp();
      this.#pinRoots();
      this.stretchCorrectionPasses += 1;
      this.maxStretchError = this.measureMaxStretchError();
    }
    this.peakStretchError = Math.max(this.peakStretchError, this.maxStretchError);
    this.#updateRootAlignment();
    this.#recordCombSample();
  }

  #recordCombSample() {
    if (!this.comb.enabled) return;
    this.combMeasurementStep += 1;
    if (this.combMeasurementStep % this.combTraceStride !== 0) return;
    if (this.combTrace.length >= 128) {
      this.combTrace = this.combTrace.filter((_sample, index) => index % 2 === 0);
      this.combTraceStride *= 2;
    }
    this.combTrace.push({
      step: this.combMeasurementStep,
      x: this.comb.currentX,
      phase: this.comb.phase,
      displacement: this.combTravel,
      reaction_proxy: this.combReaction,
      accumulated_work_proxy: this.combWork,
      max_relative_stretch_error: this.maxStretchError,
      contacts: this.combContacts,
      clump_captures: this.windowClumpCaptures,
      clump_releases: this.windowClumpReleases,
      persistent_clump_bonds: this.clumpBonds.size,
      maximum_clump_age_steps: Math.max(0, ...this.clumpBondAges.values()),
      contact_services: this.contactServicesLastStep,
      maximum_service_gap_steps: this.maxContactServiceGap,
    });
  }

  #projectComb(step) {
    this.combContacts = 0;
    this.combReaction = 0;
    if (!this.comb.enabled) return;
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      for (let particle = 2; particle <= this.activeSegments[strand]; particle += 1) {
        const index = this.index(strand, particle);
        const y = this.positions[index + 1];
        const z = this.positions[index + 2];
        if (y < this.comb.yMin || y > this.comb.yMax || z < this.comb.zMin || z > this.comb.zMax)
          continue;
        const result = projectCombSweep(
          [this.positions[index], y, z],
          this.comb.previousX,
          this.comb.currentX,
          this.comb.clearance
        );
        if (!result.active) continue;
        this.positions[index] += result.correction[0];
        this.combReaction += Math.abs(result.correction[0]) / (step * step);
        this.combContacts += 1;
      }
    }
    const travel = Math.abs(this.comb.currentX - this.comb.previousX);
    this.combTravel += travel;
    const work = this.combReaction * travel;
    this.combWork += work;
    if (this.comb.phase === "return") this.combReturnWork += work;
    else this.combForwardWork += work;
    this.combPeakReaction = Math.max(this.combPeakReaction, this.combReaction);
  }

  #buildNeighborPairs(neighborsPerRoot) {
    const keys = new Set();
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      const a = strand * 3;
      const candidates = [];
      for (let other = 0; other < this.guideCount; other += 1) {
        if (strand === other) continue;
        const b = other * 3;
        candidates.push({
          other,
          distanceSquared:
            (this.roots[a] - this.roots[b]) ** 2 +
            (this.roots[a + 1] - this.roots[b + 1]) ** 2 +
            (this.roots[a + 2] - this.roots[b + 2]) ** 2,
        });
      }
      candidates.sort((left, right) => left.distanceSquared - right.distanceSquared);
      for (const candidate of candidates.slice(0, neighborsPerRoot)) {
        keys.add(
          strand < candidate.other ? `${strand}:${candidate.other}` : `${candidate.other}:${strand}`
        );
      }
    }
    return Array.from(keys, (key) => key.split(":").map(Number));
  }

  #applyNeighborFriction() {
    const contactRadius = 0.14 + this.material.clump * 0.3;
    const axialBlend = this.material.friction * 0.045;
    const transverseBlend = this.material.friction * 0.24;
    let contacts = 0;
    for (const [strandA, strandB] of this.neighborPairs) {
      const active = Math.min(this.activeSegments[strandA], this.activeSegments[strandB]);
      for (let particle = 2; particle <= active; particle += 1) {
        const a = this.index(strandA, particle);
        const b = this.index(strandB, particle);
        const distance = length3(
          this.positions[b] - this.positions[a],
          this.positions[b + 1] - this.positions[a + 1],
          this.positions[b + 2] - this.positions[a + 2]
        );
        if (distance > contactRadius) continue;
        const velocityA = [
          this.positions[a] - this.previous[a],
          this.positions[a + 1] - this.previous[a + 1],
          this.positions[a + 2] - this.previous[a + 2],
        ];
        const velocityB = [
          this.positions[b] - this.previous[b],
          this.positions[b + 1] - this.previous[b + 1],
          this.positions[b + 2] - this.previous[b + 2],
        ];
        const priorA = this.index(strandA, particle - 1);
        const nextIndexA = this.index(strandA, Math.min(active, particle + 1));
        const priorB = this.index(strandB, particle - 1);
        const nextIndexB = this.index(strandB, Math.min(active, particle + 1));
        const tangent = normalize3(
          this.positions[nextIndexA] -
            this.positions[priorA] +
            this.positions[nextIndexB] -
            this.positions[priorB],
          this.positions[nextIndexA + 1] -
            this.positions[priorA + 1] +
            this.positions[nextIndexB + 1] -
            this.positions[priorB + 1],
          this.positions[nextIndexA + 2] -
            this.positions[priorA + 2] +
            this.positions[nextIndexB + 2] -
            this.positions[priorB + 2]
        );
        const [nextA, nextB] = blendPairAnisotropicFriction(
          velocityA,
          velocityB,
          tangent,
          axialBlend,
          transverseBlend
        );
        for (let axis = 0; axis < 3; axis += 1) {
          this.previous[a + axis] = this.positions[a + axis] - nextA[axis];
          this.previous[b + axis] = this.positions[b + axis] - nextB[axis];
        }
        contacts += 1;
      }
    }
    this.activeNeighborContacts = contacts;
  }

  #updateClumpBonds() {
    const captureRadius = 0.075 + this.material.clump * 0.14;
    const releaseRadius = captureRadius + 0.035 + this.material.clump * 0.035;
    let captures = 0;
    let releases = 0;
    let services = 0;
    for (let pairIndex = 0; pairIndex < this.neighborPairs.length; pairIndex += 1) {
      const [strandA, strandB] = this.neighborPairs[pairIndex];
      const active = Math.min(this.activeSegments[strandA], this.activeSegments[strandB]);
      for (let particle = 2; particle <= active; particle += 1) {
        const a = this.index(strandA, particle);
        const b = this.index(strandB, particle);
        const distance = length3(
          this.positions[b] - this.positions[a],
          this.positions[b + 1] - this.positions[a + 1],
          this.positions[b + 2] - this.positions[a + 2]
        );
        const key = `${pairIndex}:${particle}`;
        const priorServiceStep = this.contactLastServiced.get(key);
        if (priorServiceStep !== undefined) {
          this.maxContactServiceGap = Math.max(
            this.maxContactServiceGap,
            this.simulationStep - priorServiceStep
          );
        }
        this.contactLastServiced.set(key, this.simulationStep);
        services += 1;
        const wasBonded = this.clumpBonds.has(key);
        const isBonded = updateClumpBond(wasBonded, distance, captureRadius, releaseRadius);
        if (isBonded && !wasBonded) {
          this.clumpBonds.add(key);
          this.clumpBondAges.set(key, 1);
          captures += 1;
        } else if (isBonded) {
          this.clumpBondAges.set(key, (this.clumpBondAges.get(key) ?? 0) + 1);
        } else if (!isBonded && wasBonded) {
          this.clumpBonds.delete(key);
          this.clumpBondAges.delete(key);
          releases += 1;
        }
      }
    }
    this.clumpCaptures = captures;
    this.clumpReleases = releases;
    this.contactServicesLastStep = services;
    this.windowContactServices += services;
    this.windowClumpCaptures += captures;
    this.windowClumpReleases += releases;
  }

  #projectCollectivePairs() {
    const strength = this.material.clump * 0.055;
    const contactRadius = 0.29 + this.material.clump * 0.28;
    const targetGap = 0.035 + (1 - this.material.clump) * 0.075;
    const minimumGap = Math.max(0.024, targetGap * 0.58);
    let corrections = 0;
    let pressureCorrections = 0;
    for (let pairIndex = 0; pairIndex < this.neighborPairs.length; pairIndex += 1) {
      const [strandA, strandB] = this.neighborPairs[pairIndex];
      const active = Math.min(this.activeSegments[strandA], this.activeSegments[strandB]);
      for (let particle = 2; particle <= active; particle += 1) {
        const a = this.index(strandA, particle);
        const b = this.index(strandB, particle);
        const positionA = [this.positions[a], this.positions[a + 1], this.positions[a + 2]];
        const positionB = [this.positions[b], this.positions[b + 1], this.positions[b + 2]];
        const pressure = projectPressurePair(positionA, positionB, minimumGap, 0.36);
        if (pressure.active) {
          for (let axis = 0; axis < 3; axis += 1) {
            this.positions[a + axis] += pressure.correctionA[axis];
            this.positions[b + axis] += pressure.correctionB[axis];
          }
          pressureCorrections += 1;
          continue;
        }
        if (!this.clumpBonds.has(`${pairIndex}:${particle}`)) continue;
        const result = projectCohesionPair(
          positionA,
          positionB,
          targetGap,
          contactRadius,
          strength
        );
        if (!result.active) continue;
        for (let axis = 0; axis < 3; axis += 1) {
          this.positions[a + axis] += result.correctionA[axis];
          this.positions[b + axis] += result.correctionB[axis];
        }
        corrections += 1;
      }
    }
    this.cohesionCorrections = corrections;
    this.pressureCorrections = pressureCorrections;
  }

  #projectLengths() {
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      for (let segment = 0; segment < this.activeSegments[strand]; segment += 1) {
        const a = this.index(strand, segment);
        const b = this.index(strand, segment + 1);
        const result = projectPair(
          [this.positions[a], this.positions[a + 1], this.positions[a + 2]],
          [this.positions[b], this.positions[b + 1], this.positions[b + 2]],
          segment === 0 ? 0 : 1,
          1,
          this.restLengths[strand * this.segments + segment],
          1
        );
        for (let axis = 0; axis < 3; axis += 1) {
          this.positions[a + axis] += result.correctionA[axis];
          this.positions[b + axis] += result.correctionB[axis];
        }
      }
    }
  }

  #projectRestCurvature() {
    const stiffness = this.material.bendStiffness;
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      for (let particle = 1; particle < this.activeSegments[strand]; particle += 1) {
        const prior = this.index(strand, particle - 1);
        const middle = this.index(strand, particle);
        const next = this.index(strand, particle + 1);
        const w0 = particle === 1 ? 0 : 1;
        const denominator = w0 + 4 + 1;
        for (let axis = 0; axis < 3; axis += 1) {
          const currentSecond =
            this.positions[prior + axis] -
            2 * this.positions[middle + axis] +
            this.positions[next + axis];
          const restSecond =
            this.rest[prior + axis] - 2 * this.rest[middle + axis] + this.rest[next + axis];
          const residual = currentSecond - restSecond;
          this.positions[prior + axis] -= (stiffness * w0 * residual) / denominator;
          this.positions[middle + axis] += (stiffness * 2 * residual) / denominator;
          this.positions[next + axis] -= (stiffness * residual) / denominator;
        }
      }
    }
  }

  #projectRootDirector() {
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      const active = Math.min(this.rootDirector.zoneSegments, this.activeSegments[strand]);
      for (let segment = 0; segment < active; segment += 1) {
        const anchor = this.index(strand, segment);
        const point = this.index(strand, segment + 1);
        const target = (strand * this.rootDirector.zoneSegments + segment) * 3;
        const strength = this.rootDirector.strength * this.rootDirector.falloff ** segment;
        const projection = projectRootDirectorPoint(
          this.positions[anchor],
          this.positions[anchor + 1],
          this.positions[anchor + 2],
          this.positions[point],
          this.positions[point + 1],
          this.positions[point + 2],
          this.rootDirectorTargets[target],
          this.rootDirectorTargets[target + 1],
          this.rootDirectorTargets[target + 2],
          this.restLengths[strand * this.segments + segment],
          strength,
          this.rootDirectorProjection
        );
        this.positions[point] = projection[0];
        this.positions[point + 1] = projection[1];
        this.positions[point + 2] = projection[2];
        if (projection[4] > 1e-12) this.rootDirector.correctionsLastStep += 1;
        this.rootDirector.correctionDistanceLastStep += projection[4];
      }
    }
  }

  #updateRootAlignment() {
    const alignment = summarizeRootAlignment(
      this.positions,
      this.roots,
      this.rootNormals,
      this.particlesPerGuide
    );
    this.rootDirector.minimumNormalDot = alignment.minimum;
    this.rootDirector.meanNormalDot = alignment.mean;
    const targetAlignment = summarizeRootTargetAlignment(
      this.positions,
      this.roots,
      this.rootDirectorTargets,
      this.particlesPerGuide,
      this.rootDirector.zoneSegments
    );
    this.rootDirector.minimumTargetDot = targetAlignment.minimum;
    this.rootDirector.meanTargetDot = targetAlignment.mean;
  }

  #projectSectionLift() {
    if (this.sectionLift <= 0) return;
    const targetParticle = Math.max(2, Math.round(this.segments * 0.48));
    const strength = 1 - (1 - SECTION_LIFT_STEP_STRENGTH) ** (1 / this.iterations);
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      const rootZ = this.roots[strand * 3 + 2];
      const rootX = this.roots[strand * 3];
      if (rootZ < 0.35 || Math.abs(rootX) > 0.52 || targetParticle > this.activeSegments[strand])
        continue;
      const index = this.index(strand, targetParticle);
      const rest = this.index(strand, targetParticle);
      const dx = (this.rest[rest] - this.positions[index]) * strength;
      const dy = (this.rest[rest + 1] + this.sectionLift - this.positions[index + 1]) * strength;
      const dz =
        (this.rest[rest + 2] + this.sectionLift * 0.5 - this.positions[index + 2]) * strength;
      this.positions[index] += dx;
      this.positions[index + 1] += dy;
      this.positions[index + 2] += dz;
      this.sectionLiftCorrections += 1;
      this.sectionLiftCorrectionDistance += length3(dx, dy, dz);
    }
  }

  #projectSectionPose() {
    const pose = this.sectionPose;
    if (pose.section < 0 || (pose.lift <= 0 && Math.abs(pose.sweep) <= 1e-12)) return;
    const angle = -Math.PI + ((pose.section + 0.5) * Math.PI * 2) / ROOT_STYLE_SECTION_COUNT;
    const tangentX = -Math.sin(angle);
    const tangentZ = Math.cos(angle);
    const strength = 1 - (1 - SECTION_POSE_STEP_STRENGTH) ** (1 / this.iterations);
    let activeGuideCount = 0;
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      if (this.guideSections[strand] !== pose.section) continue;
      let active = false;
      for (let control = 0; control < SECTION_POSE_CONTROL_FRACTIONS.length; control += 1) {
        const targetParticle = Math.max(
          2,
          Math.round(this.segments * SECTION_POSE_CONTROL_FRACTIONS[control])
        );
        if (targetParticle > this.activeSegments[strand]) continue;
        const weight = SECTION_POSE_CONTROL_WEIGHTS[control];
        const index = this.index(strand, targetParticle);
        const targetX = this.rest[index] + tangentX * pose.sweep * weight;
        const targetY = this.rest[index + 1] + pose.lift * weight;
        const targetZ = this.rest[index + 2] + tangentZ * pose.sweep * weight;
        const dx = (targetX - this.positions[index]) * strength;
        const dy = (targetY - this.positions[index + 1]) * strength;
        const dz = (targetZ - this.positions[index + 2]) * strength;
        this.positions[index] += dx;
        this.positions[index + 1] += dy;
        this.positions[index + 2] += dz;
        pose.correctionsLastStep += 1;
        pose.correctionDistanceLastStep += length3(dx, dy, dz);
        active = true;
      }
      if (active) activeGuideCount += 1;
    }
    pose.activeGuideCountLastStep = activeGuideCount;
  }

  #projectScalp() {
    const center = SCALP_CENTER;
    const radii = SCALP_RADII.map((radius) => radius + 0.035);
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      for (let particle = 1; particle <= this.activeSegments[strand]; particle += 1) {
        const index = this.index(strand, particle);
        const local = [
          this.positions[index] - center[0],
          this.positions[index + 1] - center[1],
          this.positions[index + 2] - center[2],
        ];
        const normalizedSquared =
          (local[0] / radii[0]) ** 2 + (local[1] / radii[1]) ** 2 + (local[2] / radii[2]) ** 2;
        if (normalizedSquared >= 1) continue;
        const scale = 1 / Math.sqrt(Math.max(normalizedSquared, 1e-12));
        this.positions[index] = center[0] + local[0] * scale;
        this.positions[index + 1] = center[1] + local[1] * scale;
        this.positions[index + 2] = center[2] + local[2] * scale;
      }
    }
  }

  #projectFaceClearGroom() {
    if (!this.faceClearGroom.enabled) return;
    const startParticle = Math.max(2, Math.round(this.segments * 0.22));
    const endParticle = Math.min(this.segments, Math.round(this.segments * 0.68));
    const strength = 1 - (1 - FACE_CLEAR_STEP_STRENGTH) ** (1 / this.iterations);
    let activeGuideCount = 0;
    let affectedGuideCount = 0;
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      const root = strand * 3;
      const front = this.rootNormals[root + 2];
      const side = Math.abs(this.rootNormals[root]);
      if (front <= 0.34 || side >= 0.64) continue;
      const sideSign = this.roots[root] < ROOT_STYLE_PART_X ? -1 : 1;
      affectedGuideCount += 1;
      let active = false;
      for (let particle = startParticle; particle <= endParticle; particle += 1) {
        if (particle > this.activeSegments[strand]) continue;
        const index = this.index(strand, particle);
        const span = Math.max(1, endParticle - startParticle);
        const phase = (particle - startParticle) / span;
        const weight = Math.sin(Math.PI * phase) ** 2;
        if (weight <= 1e-8) continue;
        const minimumSideClearance = 0.58 + 0.18 * weight;
        const targetX = sideSign * Math.max(Math.abs(this.rest[index]), minimumSideClearance);
        const targetZ = Math.min(this.rest[index + 2], 0.24);
        const dx = (targetX - this.positions[index]) * strength * weight;
        const dz = (targetZ - this.positions[index + 2]) * strength * weight;
        this.positions[index] += dx;
        this.positions[index + 2] += dz;
        this.faceClearGroom.correctionsLastStep += 1;
        this.faceClearGroom.correctionDistanceLastStep += Math.hypot(dx, dz);
        active = true;
      }
      if (active) activeGuideCount += 1;
    }
    this.faceClearGroom.affectedGuideCount = affectedGuideCount;
    this.faceClearGroom.activeGuideCountLastStep = activeGuideCount;
  }

  #pinRoots() {
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      const index = this.index(strand, 0);
      for (let axis = 0; axis < 3; axis += 1) {
        this.positions[index + axis] = this.roots[strand * 3 + axis];
        this.previous[index + axis] = this.roots[strand * 3 + axis];
      }
    }
  }

  measureMaxStretchError() {
    let maximum = 0;
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      for (let segment = 0; segment < this.activeSegments[strand]; segment += 1) {
        const a = this.index(strand, segment);
        const b = this.index(strand, segment + 1);
        const distance = length3(
          this.positions[b] - this.positions[a],
          this.positions[b + 1] - this.positions[a + 1],
          this.positions[b + 2] - this.positions[a + 2]
        );
        const rest = this.restLengths[strand * this.segments + segment];
        maximum = Math.max(maximum, Math.abs(distance - rest) / rest);
      }
    }
    return maximum;
  }

  receipt() {
    const stretchSatisfied = this.peakStretchError <= this.stretchThreshold;
    const assumptionsPending = this.measurementWindow === "comb_settling";
    const clumpAges = Array.from(this.clumpBondAges.values());
    const maximumClumpAge = Math.max(0, ...clumpAges);
    const meanClumpAge =
      clumpAges.length > 0 ? clumpAges.reduce((sum, age) => sum + age, 0) / clumpAges.length : 0;
    const contactCandidateCapacity = this.neighborPairs.length * Math.max(0, this.segments - 1);
    const contactServiceSatisfied =
      this.maxContactServiceGap <= 1 &&
      this.contactServicesLastStep <= contactCandidateCapacity &&
      this.clumpBondAges.size === this.clumpBonds.size;
    return {
      schema: "hair-material-bench/3",
      guide_count: this.guideCount,
      render_fiber_count: this.guideCount * this.renderFibersPerGuide,
      segments_per_guide: this.segments,
      active_segments: Array.from(this.activeSegments).reduce((sum, value) => sum + value, 0),
      preset: this.preset,
      material: { ...this.material },
      wind: {
        magnitude: this.wind,
        mode: this.directionalWind ? "directional" : "legacy_scalar",
        angle_radians: this.windAngle,
        direction: [...this.windDirection],
      },
      root_director: {
        enabled: this.rootDirector.enabled,
        mode: this.rootDirector.mode,
        field_identity:
          this.rootDirector.mode === "styled_side_part"
            ? ROOT_STYLE_FIELD_ID
            : this.rootDirector.mode === "scalp_normal"
              ? "scalp_normal_v1"
              : "free_v1",
        strength: this.rootDirector.strength,
        zone_segments: this.rootDirector.zoneSegments,
        falloff: this.rootDirector.falloff,
        normal_biases:
          this.rootDirector.mode === "styled_side_part"
            ? [...ROOT_DIRECTOR_STYLED_BIASES]
            : [...this.rootDirector.normalBiases],
        section_count: this.rootDirector.mode === "styled_side_part" ? ROOT_STYLE_SECTION_COUNT : 0,
        part_x: this.rootDirector.mode === "styled_side_part" ? ROOT_STYLE_PART_X : null,
        corrections_last_step: this.rootDirector.correctionsLastStep,
        correction_distance_last_step: this.rootDirector.correctionDistanceLastStep,
        minimum_first_segment_normal_dot: this.rootDirector.minimumNormalDot,
        mean_first_segment_normal_dot: this.rootDirector.meanNormalDot,
        minimum_first_segment_target_dot: this.rootDirector.minimumTargetDot,
        mean_first_segment_target_dot: this.rootDirector.meanTargetDot,
        minimum_target_outward_dot: this.rootDirector.minimumTargetOutwardDot,
        mean_target_outward_dot: this.rootDirector.meanTargetOutwardDot,
        mean_target_tangential_magnitude: this.rootDirector.meanTargetTangentialMagnitude,
        exact_antipodal_boundary: "tangent_correction_zero",
      },
      scalp_layout: {
        field_identity: SCALP_LAYOUT_ID,
        crown_guide_count: this.scalpLayout.crownGuideCount,
        front_center_guide_count: this.scalpLayout.frontCenterGuideCount,
        minimum_front_center_normal_y: this.scalpLayout.minimumFrontCenterNormalY,
        maximum_front_center_theta_radians: this.scalpLayout.maximumFrontCenterTheta,
        collision_proxy: "analytic_ellipsoid_unchanged",
      },
      face_clear_groom: {
        enabled: this.faceClearGroom.enabled,
        field_identity: FACE_CLEAR_GROOM_ID,
        affected_guides: this.faceClearGroom.affectedGuideCount,
        active_guides_last_step: this.faceClearGroom.activeGuideCountLastStep,
        corrections_last_step: this.faceClearGroom.correctionsLastStep,
        correction_distance_last_step: this.faceClearGroom.correctionDistanceLastStep,
        step_strength: FACE_CLEAR_STEP_STRENGTH,
        per_iteration_strength: 1 - (1 - FACE_CLEAR_STEP_STRENGTH) ** (1 / this.iterations),
        particle_fraction_range: [0.22, 0.68],
        clearance_target: "outside_0.58m_cheek_width_and_behind_z_0.24m",
        physics_authority: "bounded_styled_face_volume_projection",
      },
      section_lift: {
        enabled: this.sectionLift > 0,
        phase: this.sectionLiftPhase,
        target_meters: this.sectionLift,
        target_particle: Math.max(2, Math.round(this.segments * 0.48)),
        step_strength: SECTION_LIFT_STEP_STRENGTH,
        per_iteration_strength: 1 - (1 - SECTION_LIFT_STEP_STRENGTH) ** (1 / this.iterations),
        corrections_last_step: this.sectionLiftCorrections,
        correction_distance_last_step: this.sectionLiftCorrectionDistance,
        correction_distance_unit: "summed_solver_position",
      },
      section_pose: {
        enabled:
          this.sectionPose.section >= 0 &&
          (this.sectionPose.lift > 0 || Math.abs(this.sectionPose.sweep) > 1e-12),
        field_identity: SECTION_POSE_FIELD_ID,
        phase: this.sectionPose.phase,
        selected_section: this.sectionPose.section >= 0 ? this.sectionPose.section : null,
        section_count: ROOT_STYLE_SECTION_COUNT,
        lift_meters: this.sectionPose.lift,
        tangential_sweep_meters: this.sectionPose.sweep,
        control_fractions: [...SECTION_POSE_CONTROL_FRACTIONS],
        control_weights: [...SECTION_POSE_CONTROL_WEIGHTS],
        affected_guides: this.sectionPose.affectedGuideCount,
        active_guides_last_step: this.sectionPose.activeGuideCountLastStep,
        step_strength: SECTION_POSE_STEP_STRENGTH,
        per_iteration_strength: 1 - (1 - SECTION_POSE_STEP_STRENGTH) ** (1 / this.iterations),
        corrections_last_step: this.sectionPose.correctionsLastStep,
        correction_distance_last_step: this.sectionPose.correctionDistanceLastStep,
        correction_distance_unit: "summed_solver_position",
      },
      iterations: this.iterations,
      max_relative_stretch_error: this.maxStretchError,
      peak_relative_stretch_error: this.peakStretchError,
      stretch_correction_passes_last_step: this.stretchCorrectionPasses,
      cut_count: this.cutCount,
      root_neighbor_pairs: this.neighborPairs.length,
      active_neighbor_contacts: this.activeNeighborContacts,
      cohesion_corrections_last_iteration: this.cohesionCorrections,
      crowd_pressure_corrections_last_iteration: this.pressureCorrections,
      persistent_clump_bonds: this.clumpBonds.size,
      persistent_contact_memory: {
        active_bonds: this.clumpBonds.size,
        mean_age_steps: meanClumpAge,
        maximum_age_steps: maximumClumpAge,
        age_entries_match_active_bonds: this.clumpBondAges.size === this.clumpBonds.size,
      },
      contact_service: {
        scheduler: "exhaustive_bounded_root_neighbor_graph",
        candidate_capacity: contactCandidateCapacity,
        services_last_step: this.contactServicesLastStep,
        services_during_window: this.windowContactServices,
        maximum_observed_gap_steps: this.maxContactServiceGap,
        service_gap_bound_steps: 1,
        satisfied: contactServiceSatisfied,
      },
      spatial_friction: spatialFrictionReceipt(this.spatialFriction, this.material),
      clump_captures_last_step: this.clumpCaptures,
      clump_releases_last_step: this.clumpReleases,
      comb: {
        enabled: this.comb.enabled,
        x: this.comb.currentX,
        contacts_last_step: this.combContacts,
        reaction_proxy_last_step: this.combReaction,
        peak_reaction_proxy: this.combPeakReaction,
        accumulated_work_proxy: this.combWork,
        forward_work_proxy: this.combForwardWork,
        return_work_proxy: this.combReturnWork,
        cycle_dissipation_proxy: this.combForwardWork + this.combReturnWork,
        accumulated_travel: this.combTravel,
        clump_captures_during_window: this.windowClumpCaptures,
        clump_releases_during_window: this.windowClumpReleases,
        force_displacement_trace: this.combTrace.map((sample) => ({ ...sample })),
        trace_sample_stride: this.combTraceStride,
      },
      assumption_receipt: {
        schema: "hair-material-assumptions/2",
        measurement_window: this.measurementWindow,
        status: assumptionsPending
          ? "not_measured"
          : stretchSatisfied && this.combWork >= 0 && contactServiceSatisfied
            ? "satisfied"
            : "violated",
        stretch: {
          threshold: this.stretchThreshold,
          observed_peak: this.peakStretchError,
          satisfied: stretchSatisfied,
        },
        crowd_pressure_strength: { value: 0.36, upper_bound: 0.5, satisfied: true },
        persistent_contact_service: {
          maximum_observed_gap_steps: this.maxContactServiceGap,
          bound_steps: 1,
          age_entries_match_active_bonds: this.clumpBondAges.size === this.clumpBonds.size,
          satisfied: contactServiceSatisfied,
        },
        comb_work_nonnegative: this.combWork >= 0,
      },
      solver: "CPU Verlet plus distance and rest-curvature projections",
      collective_model:
        "bounded anisotropic friction, hysteretic clumps, cohesion, and crowd pressure",
      collective_rules_enabled: this.collectiveRulesEnabled,
      continuum_hair_mechanics: false,
      strand_self_contact: false,
      dense_fibers_are_interpolated: true,
    };
  }
}
