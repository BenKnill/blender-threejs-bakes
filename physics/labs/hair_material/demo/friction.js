function length3(x, y, z) {
  return Math.hypot(x, y, z);
}

function normalize3(x, y, z) {
  const length = length3(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

export function blendPairAnisotropicFriction(
  velocityA,
  velocityB,
  tangent,
  axialFriction,
  transverseFriction
) {
  const direction = normalize3(...tangent);
  const axialBlend = Math.max(0, Math.min(1, axialFriction));
  const transverseBlend = Math.max(0, Math.min(1, transverseFriction));
  const relative = velocityB.map((value, axis) => value - velocityA[axis]);
  const axialMagnitude = relative.reduce((sum, value, axis) => sum + value * direction[axis], 0);
  const axial = direction.map((value) => value * axialMagnitude);
  const correction = relative.map(
    (value, axis) => 0.5 * (axial[axis] * axialBlend + (value - axial[axis]) * transverseBlend)
  );
  return [
    velocityA.map((value, axis) => value + correction[axis]),
    velocityB.map((value, axis) => value - correction[axis]),
  ];
}

export function barycentricEndpointWeights(parameter) {
  const clamped = Math.max(0, Math.min(1, parameter));
  return [1 - clamped, clamped];
}
