import * as THREE from "three";

const MOTION_SCHEMA = "motion-clip/1";

export function createMotionPlayer({ getInstances, onStateChange = () => {} }) {
  let clip = null;
  let elapsed = 0;
  let playing = false;

  function load(nextClip) {
    validateClip(nextClip);
    clip = nextClip;
    elapsed = 0;
    playing = false;
    applyAt(0);
    publish();
  }

  function update(deltaSeconds) {
    if (!clip || !playing) return;
    elapsed += Math.max(0, deltaSeconds);
    const duration = clip.duration_s;
    if (duration > 0) elapsed %= duration;
    applyAt(elapsed);
    publish();
  }

  function toggle() {
    if (!clip) return;
    playing = !playing;
    publish();
  }

  function reset() {
    if (!clip) return;
    elapsed = 0;
    playing = false;
    applyAt(0);
    publish();
  }

  function applyAt(timeSeconds) {
    if (!clip) return;
    const frames = clip.frames;
    const nextIndex = frames.findIndex((frame) => frame.time_s >= timeSeconds);
    const upperIndex = nextIndex < 0 ? frames.length - 1 : nextIndex;
    const lowerIndex = Math.max(0, upperIndex - (frames[upperIndex].time_s > timeSeconds ? 1 : 0));
    const lower = frames[lowerIndex];
    const upper = frames[upperIndex];
    const span = upper.time_s - lower.time_s;
    const alpha = span > 0 ? (timeSeconds - lower.time_s) / span : 0;
    const blend = Math.max(0, Math.min(1, alpha));
    const instances = getInstances();

    for (const [entityId, lowerState] of Object.entries(lower.entities)) {
      const object = instances.get(entityId);
      if (!object) continue;
      const upperState = upper.entities[entityId] || lowerState;
      object.position.lerpVectors(
        vector(lowerState.position_m),
        vector(upperState.position_m),
        blend
      );
      object.quaternion.slerpQuaternions(
        quaternion(lowerState.orientation_xyzw),
        quaternion(upperState.orientation_xyzw),
        blend
      );
    }
  }

  function publish() {
    onStateChange({
      loaded: Boolean(clip),
      playing,
      time_s: elapsed,
      duration_s: clip?.duration_s || 0,
      frame_count: clip?.frames.length || 0,
    });
  }

  return { load, update, toggle, reset, hasClip: () => Boolean(clip) };
}

function validateClip(value) {
  if (!value || value.schema !== MOTION_SCHEMA) throw new Error(`Expected ${MOTION_SCHEMA}`);
  if (!Array.isArray(value.frames) || value.frames.length === 0) {
    throw new Error("Motion clip must contain at least one frame");
  }
  if (!Number.isFinite(value.duration_s) || value.duration_s < 0) {
    throw new Error("Motion clip duration_s must be non-negative");
  }
  for (const frame of value.frames) {
    if (!Number.isFinite(frame.time_s) || !frame.entities) {
      throw new Error("Motion clip frames need time_s and entities");
    }
    for (const state of Object.values(frame.entities)) {
      if (!Array.isArray(state.position_m) || !Array.isArray(state.orientation_xyzw)) {
        throw new Error("Motion clip entity states need position_m and orientation_xyzw");
      }
    }
  }
}

function vector(values) {
  return new THREE.Vector3(values[0], values[1], values[2]);
}

function quaternion(values) {
  return new THREE.Quaternion(values[0], values[1], values[2], values[3]);
}
