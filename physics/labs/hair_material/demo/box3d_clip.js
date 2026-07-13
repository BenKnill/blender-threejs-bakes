export function sampleQuantizedGuideClip(metadata, quantized, timeSeconds, output) {
  if (metadata.schema !== "hair-box3d-guide-clip/1") {
    throw new Error(`unsupported Box3D guide clip schema: ${metadata.schema}`);
  }
  const valuesPerFrame = metadata.guide_count * metadata.particles_per_guide * 3;
  if (quantized.length !== valuesPerFrame * metadata.frame_count) {
    throw new Error("Box3D guide clip length does not match its metadata");
  }
  if (output.length !== valuesPerFrame) {
    throw new Error("Box3D guide clip output has the wrong length");
  }
  const clampedTime = Math.max(0, Math.min(metadata.duration_s, timeSeconds));
  const framePosition = clampedTime * metadata.sample_hz;
  const frameA = Math.min(metadata.frame_count - 1, Math.floor(framePosition));
  const frameB = Math.min(metadata.frame_count - 1, frameA + 1);
  const alpha = framePosition - frameA;
  const offsetA = frameA * valuesPerFrame;
  const offsetB = frameB * valuesPerFrame;
  for (let index = 0; index < valuesPerFrame; index += 1) {
    output[index] =
      (quantized[offsetA + index] +
        (quantized[offsetB + index] - quantized[offsetA + index]) * alpha) *
      metadata.quantization_m;
  }
  return { frameA, frameB, alpha, timeSeconds: clampedTime };
}

export async function loadBox3dGuideClip(metadataUrl) {
  const metadataResponse = await fetch(metadataUrl, { cache: "no-cache" });
  if (!metadataResponse.ok) {
    throw new Error(`Box3D clip metadata failed: ${metadataResponse.status}`);
  }
  const metadata = await metadataResponse.json();
  const binaryUrl = new URL(metadata.binary, metadataResponse.url);
  const binaryResponse = await fetch(binaryUrl, { cache: "force-cache" });
  if (!binaryResponse.ok) {
    throw new Error(`Box3D clip binary failed: ${binaryResponse.status}`);
  }
  const quantized = new Int16Array(await binaryResponse.arrayBuffer());
  const expectedValues =
    metadata.frame_count * metadata.guide_count * metadata.particles_per_guide * 3;
  if (quantized.length !== expectedValues) {
    throw new Error(`Box3D clip has ${quantized.length} values; expected ${expectedValues}`);
  }
  return Object.freeze({ metadata: Object.freeze(metadata), quantized });
}
