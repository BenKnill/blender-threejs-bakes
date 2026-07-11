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

const HEAD = Object.freeze({ center: [0, 1.35, 0], radii: [0.9, 1.12, 0.82] });
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function length3(x, y, z) {
  return Math.hypot(x, y, z);
}

function normalize3(x, y, z) {
  const length = length3(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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

function rootFrame(index, count) {
  const fraction = (index + 0.5) / count;
  const theta = 0.1 + 1.18 * Math.sqrt(fraction);
  const phi = index * GOLDEN_ANGLE;
  const sinTheta = Math.sin(theta);
  const normal = normalize3(sinTheta * Math.cos(phi), Math.cos(theta), sinTheta * Math.sin(phi));
  const root = [
    HEAD.center[0] + HEAD.radii[0] * normal[0],
    HEAD.center[1] + HEAD.radii[1] * normal[1],
    HEAD.center[2] + HEAD.radii[2] * normal[2],
  ];
  const tangent = normalize3(...cross3([0, 1, 0], normal));
  const bitangent = normalize3(...cross3(normal, tangent));
  return { root, normal, tangent, bitangent, phi };
}

function restPoint(frame, material, segment, segments) {
  if (segment === 0) return frame.root;
  const s = segment / segments;
  const angle = s * material.curlTurns * Math.PI * 2 + frame.phi;
  const baseCos = Math.cos(frame.phi);
  const baseSin = Math.sin(frame.phi);
  const curlU = material.curlRadius * (Math.cos(angle) - baseCos);
  const curlV = material.curlRadius * (Math.sin(angle) - baseSin);
  const lift = 0.16 * Math.sin(Math.min(1, s * 3) * Math.PI * 0.5);
  return [
    frame.root[0] + frame.normal[0] * lift + frame.tangent[0] * curlU + frame.bitangent[0] * curlV,
    frame.root[1] +
      frame.normal[1] * lift -
      material.length * s +
      frame.tangent[1] * curlU +
      frame.bitangent[1] * curlV,
    frame.root[2] + frame.normal[2] * lift + frame.tangent[2] * curlU + frame.bitangent[2] * curlV,
  ];
}

export class HairSolver {
  constructor({ guideCount = 512, segments = 12, preset = "wavy", iterations = 5 } = {}) {
    if (!(preset in MATERIAL_PRESETS)) throw new Error(`unknown material preset: ${preset}`);
    if (guideCount < 8 || segments < 4) throw new Error("hair solver resolution is too small");
    this.guideCount = guideCount;
    this.segments = segments;
    this.particlesPerGuide = segments + 1;
    this.iterations = iterations;
    this.preset = preset;
    this.material = { ...MATERIAL_PRESETS[preset] };
    this.particleCount = guideCount * this.particlesPerGuide;
    this.positions = new Float64Array(this.particleCount * 3);
    this.previous = new Float64Array(this.particleCount * 3);
    this.rest = new Float64Array(this.particleCount * 3);
    this.roots = new Float64Array(guideCount * 3);
    this.activeSegments = new Uint16Array(guideCount);
    this.restLengths = new Float64Array(guideCount * segments);
    this.cutCount = 0;
    this.time = 0;
    this.wind = 0.18;
    this.sectionLift = 0;
    this.maxStretchError = 0;
    this.moisture = 0;
    this.product = 0;
    this.activeNeighborContacts = 0;
    this.cohesionCorrections = 0;
    this.#initialize();
    this.neighborPairs = this.#buildNeighborPairs(3);
  }

  index(strand, particle, axis = 0) {
    return (strand * this.particlesPerGuide + particle) * 3 + axis;
  }

  #initialize() {
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      const frame = rootFrame(strand, this.guideCount);
      this.activeSegments[strand] = this.segments;
      for (let axis = 0; axis < 3; axis += 1) this.roots[strand * 3 + axis] = frame.root[axis];
      for (let particle = 0; particle <= this.segments; particle += 1) {
        const point = restPoint(frame, this.material, particle, this.segments);
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
    }
  }

  reset(preset = this.preset) {
    if (!(preset in MATERIAL_PRESETS)) throw new Error(`unknown material preset: ${preset}`);
    this.preset = preset;
    this.material = { ...MATERIAL_PRESETS[preset] };
    this.cutCount = 0;
    this.time = 0;
    this.#initialize();
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

  setSectionLift(value) {
    this.sectionLift = Math.max(0, Math.min(1.4, value));
  }

  cutStrand(strand, segment) {
    if (strand < 0 || strand >= this.guideCount) return false;
    const next = Math.max(1, Math.min(this.activeSegments[strand], Math.floor(segment)));
    if (next >= this.activeSegments[strand]) return false;
    this.activeSegments[strand] = next;
    this.cutCount += 1;
    return true;
  }

  step(dt = 1 / 60) {
    const step = Math.max(1 / 240, Math.min(1 / 30, dt));
    this.time += step;
    const damping = this.material.damping;
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      for (let particle = 1; particle <= this.activeSegments[strand]; particle += 1) {
        const base = this.index(strand, particle);
        const x = this.positions[base];
        const y = this.positions[base + 1];
        const z = this.positions[base + 2];
        const tipWeight = particle / this.segments;
        const wind = this.wind * Math.sin(this.time * 1.7 + strand * 0.071) * tipWeight;
        this.positions[base] += (x - this.previous[base]) * damping + wind * step * step;
        this.positions[base + 1] += (y - this.previous[base + 1]) * damping - 9.81 * step * step;
        this.positions[base + 2] +=
          (z - this.previous[base + 2]) * damping + 0.45 * wind * step * step;
        this.previous[base] = x;
        this.previous[base + 1] = y;
        this.previous[base + 2] = z;
      }
    }
    this.#applyNeighborFriction();
    for (let iteration = 0; iteration < this.iterations; iteration += 1) {
      this.#projectLengths();
      this.#projectRestCurvature();
      this.#projectCohesion();
      this.#projectSectionLift();
      this.#projectScalp();
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
    const blend = this.material.friction * 0.16;
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
        const [nextA, nextB] = blendPairFriction(velocityA, velocityB, blend);
        for (let axis = 0; axis < 3; axis += 1) {
          this.previous[a + axis] = this.positions[a + axis] - nextA[axis];
          this.previous[b + axis] = this.positions[b + axis] - nextB[axis];
        }
        contacts += 1;
      }
    }
    this.activeNeighborContacts = contacts;
  }

  #projectCohesion() {
    const strength = this.material.clump * 0.055;
    const contactRadius = 0.16 + this.material.clump * 0.42;
    const targetGap = 0.035 + (1 - this.material.clump) * 0.075;
    let corrections = 0;
    for (const [strandA, strandB] of this.neighborPairs) {
      const active = Math.min(this.activeSegments[strandA], this.activeSegments[strandB]);
      for (let particle = 2; particle <= active; particle += 1) {
        const a = this.index(strandA, particle);
        const b = this.index(strandB, particle);
        const result = projectCohesionPair(
          [this.positions[a], this.positions[a + 1], this.positions[a + 2]],
          [this.positions[b], this.positions[b + 1], this.positions[b + 2]],
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

  #projectSectionLift() {
    if (this.sectionLift <= 0) return;
    const targetParticle = Math.max(2, Math.round(this.segments * 0.48));
    for (let strand = 0; strand < this.guideCount; strand += 1) {
      const rootZ = this.roots[strand * 3 + 2];
      const rootX = this.roots[strand * 3];
      if (rootZ < 0.35 || Math.abs(rootX) > 0.52 || targetParticle > this.activeSegments[strand])
        continue;
      const index = this.index(strand, targetParticle);
      const rest = this.index(strand, targetParticle);
      this.positions[index] += (this.rest[rest] - this.positions[index]) * 0.18;
      this.positions[index + 1] +=
        (this.rest[rest + 1] + this.sectionLift - this.positions[index + 1]) * 0.18;
      this.positions[index + 2] +=
        (this.rest[rest + 2] + this.sectionLift * 0.5 - this.positions[index + 2]) * 0.18;
    }
  }

  #projectScalp() {
    const center = HEAD.center;
    const radii = HEAD.radii.map((radius) => radius + 0.035);
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
    return {
      schema: "hair-material-bench/1",
      guide_count: this.guideCount,
      render_fiber_count: this.guideCount * 9,
      segments_per_guide: this.segments,
      active_segments: Array.from(this.activeSegments).reduce((sum, value) => sum + value, 0),
      preset: this.preset,
      material: { ...this.material },
      iterations: this.iterations,
      max_relative_stretch_error: this.maxStretchError,
      cut_count: this.cutCount,
      root_neighbor_pairs: this.neighborPairs.length,
      active_neighbor_contacts: this.activeNeighborContacts,
      cohesion_corrections_last_iteration: this.cohesionCorrections,
      solver: "CPU Verlet plus distance and rest-curvature projections",
      collective_model: "bounded root-neighbor friction and cohesion",
      continuum_hair_mechanics: false,
      strand_self_contact: false,
      dense_fibers_are_interpolated: true,
    };
  }
}
