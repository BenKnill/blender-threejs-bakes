export const LIGHTING_PRESETS = {
  golden_hour: {
    label: "Golden hour",
    sun: {
      azimuth_deg: 120,
      elevation_deg: 8,
      color: [1, 0.86, 0.68],
      strength: 2.4,
      angle_deg: 2.6,
    },
    world: { type: "sky", strength: 0.45, color: [0.055, 0.058, 0.065], rotation_deg: 0 },
    exposure: 0,
  },
  noon: {
    label: "Noon",
    sun: {
      azimuth_deg: 160,
      elevation_deg: 62,
      color: [1, 0.96, 0.88],
      strength: 3.2,
      angle_deg: 0.7,
    },
    world: { type: "sky", strength: 1.1, color: [0.08, 0.095, 0.12], rotation_deg: 0 },
    exposure: 0,
  },
  overcast: {
    label: "Overcast",
    sun: {
      azimuth_deg: 90,
      elevation_deg: 70,
      color: [0.76, 0.82, 1],
      strength: 0.5,
      angle_deg: 8,
    },
    world: { type: "color", strength: 1.4, color: [0.42, 0.46, 0.5], rotation_deg: 0 },
    exposure: 0.15,
  },
  studio: {
    label: "Studio",
    sun: {
      azimuth_deg: 35,
      elevation_deg: 38,
      color: [1, 0.95, 0.86],
      strength: 2.4,
      angle_deg: 5,
    },
    world: { type: "color", strength: 0.65, color: [0.12, 0.12, 0.12], rotation_deg: 0 },
    exposure: 0,
  },
  night_biolume: {
    label: "Night biolume",
    sun: {
      azimuth_deg: 235,
      elevation_deg: 9,
      color: [0.42, 0.58, 1],
      strength: 0.8,
      angle_deg: 3,
    },
    world: { type: "color", strength: 0.18, color: [0.015, 0.02, 0.035], rotation_deg: 0 },
    exposure: -0.2,
  },
};

const DEFAULT_PRESET = "golden_hour";

export function createLightingControls({ elements, onChange }) {
  fillPresetOptions(elements.preset);
  elements.preset.addEventListener("change", () => {
    applyLightingToControls(elements, presetLighting(elements.preset.value));
    notify();
  });
  for (const input of lightingInputs(elements)) {
    input.addEventListener("input", notify);
  }

  applyLightingToControls(elements, presetLighting(DEFAULT_PRESET));
  notify();

  function notify() {
    onChange(currentLighting(elements));
  }
}

export function currentLighting(elements) {
  const preset = elements.preset.value || DEFAULT_PRESET;
  return {
    preset,
    sun: {
      azimuth_deg: numericValue(elements.azimuth, 120),
      elevation_deg: numericValue(elements.elevation, 8),
      color: hexToRgb(elements.sunColor.value, [1, 0.86, 0.68]),
      strength: numericValue(elements.sunStrength, 2.4),
      angle_deg: numericValue(elements.sunAngle, 2.6),
    },
    world: {
      type: elements.worldType.value || "sky",
      strength: numericValue(elements.worldStrength, 0.45),
      color: hexToRgb(elements.worldColor.value, [0.055, 0.058, 0.065]),
      rotation_deg: 0,
    },
    exposure: numericValue(elements.exposure, 0),
  };
}

export function applyLightingToControls(elements, lighting) {
  const withDefaults = mergeLighting(lighting);
  elements.preset.value = withDefaults.preset;
  elements.azimuth.value = withDefaults.sun.azimuth_deg;
  elements.elevation.value = withDefaults.sun.elevation_deg;
  elements.sunColor.value = rgbToHex(withDefaults.sun.color);
  elements.sunStrength.value = withDefaults.sun.strength;
  elements.sunAngle.value = withDefaults.sun.angle_deg;
  elements.worldType.value = withDefaults.world.type;
  elements.worldStrength.value = withDefaults.world.strength;
  elements.worldColor.value = rgbToHex(withDefaults.world.color);
  elements.exposure.value = withDefaults.exposure;
}

export function mergeLighting(lighting = {}) {
  const preset = lighting.preset || DEFAULT_PRESET;
  const base = presetLighting(preset);
  return {
    preset,
    sun: { ...base.sun, ...(lighting.sun || {}) },
    world: { ...base.world, ...(lighting.world || {}) },
    exposure: lighting.exposure ?? base.exposure,
  };
}

export function sunDirection(lighting) {
  const sun = mergeLighting(lighting).sun;
  const azimuth = degreesToRadians(sun.azimuth_deg);
  const elevation = degreesToRadians(sun.elevation_deg);
  const horizontal = Math.cos(elevation);
  return [Math.sin(azimuth) * horizontal, Math.sin(elevation), Math.cos(azimuth) * horizontal];
}

function fillPresetOptions(select) {
  select.replaceChildren();
  for (const [value, preset] of Object.entries(LIGHTING_PRESETS)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = preset.label;
    select.appendChild(option);
  }
}

function presetLighting(preset) {
  const base = LIGHTING_PRESETS[preset] || LIGHTING_PRESETS[DEFAULT_PRESET];
  return JSON.parse(JSON.stringify({ preset, ...base }));
}

function lightingInputs(elements) {
  return [
    elements.azimuth,
    elements.elevation,
    elements.sunColor,
    elements.sunStrength,
    elements.sunAngle,
    elements.worldType,
    elements.worldStrength,
    elements.worldColor,
    elements.exposure,
  ];
}

function numericValue(input, fallback) {
  const parsed = Number.parseFloat(input.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hexToRgb(value, fallback) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value || "");
  if (!match) return fallback;
  return [1, 2, 3].map((index) => Number.parseInt(match[index], 16) / 255);
}

function rgbToHex(values) {
  return `#${values
    .map((value) =>
      Math.round(Math.min(1, Math.max(0, value)) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}
