export const COMPUTE_EFFECTS = [
  {
    id: "cuda_flame",
    name: "CUDA Flame",
    bbox: [1, 1, 1],
    defaultScale: [3.5, 0.75, 0.75],
    description: "Z-aware plume cards resolved during Blender bake",
  },
  {
    id: "cuda_blue_plume",
    name: "CUDA Blue Plume",
    bbox: [1, 1, 1],
    defaultScale: [3.2, 0.55, 0.55],
    description: "Hot plasma exhaust variant with tighter emissive cards",
  },
  {
    id: "cuda_cloud_billow",
    name: "CUDA Cloud Billow",
    bbox: [1, 1, 1],
    defaultScale: [2.4, 1.3, 1.0],
    description: "Soft z-aware dust, vapor, or cloud volume cards",
  },
  {
    id: "cuda_chromosphere_lace",
    name: "CUDA Chromosphere Lace",
    bbox: [1, 1, 1],
    defaultScale: [3.0, 1.8, 0.35],
    description: "Emissive plasma sheet for shields, portals, or burn fields",
  },
  {
    id: "cuda_spark_shower",
    name: "CUDA Spark Shower",
    bbox: [1, 1, 1],
    defaultScale: [2.2, 0.75, 0.45],
    description: "Sparse z-aware particles and hot fragments",
  },
];

export const computeEffectMap = new Map(COMPUTE_EFFECTS.map((effect) => [effect.id, effect]));

export function effectById(id) {
  return computeEffectMap.get(id) || null;
}
