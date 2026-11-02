/** Official product capabilities, never inferred from stream SPS/vendor labels. */
export const C402 = Object.freeze({
  manufacturer: 'TP-Link', model: 'Tapo C402 · 1080p (1920 × 1080)',
  width: 1920, height: 1080, fps: 15, codec: 'H264',
  sourceName: 'C402 · 1080p',
  specification: 'https://www.tapo.com/us/product/tapo-c402-security-camera/specs',
  transport: 'tapo', transcoding: false,
} as const);

/** A mismatch is an audit finding, never a reason to relabel or rewrite frames. */
export function auditFrameDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Dimensiones de cuadro inválidas.');
  }
  return {
    model: C402.model,
    specified: { width: C402.width, height: C402.height },
    observed: { width, height },
    matchesSpecification: width === C402.width && height === C402.height,
    transcoding: C402.transcoding,
  };
}
