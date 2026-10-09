import { noise2D } from '@remotion/noise';

/**
 * A small 2.5D camera. World units are pixels at zoom 1. Every layer has a
 * parallax factor `p` (1 = focal plane, < 1 = farther away, > 1 = nearer):
 *
 *   screen = center + (world − cam·p) · zoom^p
 *
 * Far layers pan and zoom less than near ones, which is what sells depth
 * when the camera drifts, pushes, or shakes.
 */
export type Cam = { x: number; y: number; zoom: number; rot: number };

export type Projected = { x: number; y: number; s: number };

export const layerZoom = (cam: Cam, p: number) => Math.pow(cam.zoom, p);

export const project = (wx: number, wy: number, p: number, cam: Cam, cx: number, cy: number): Projected => {
  const s = layerZoom(cam, p);
  let dx = (wx - cam.x * p) * s;
  let dy = (wy - cam.y * p) * s;
  if (cam.rot) {
    // Camera roll, stronger on nearer layers.
    const a = (cam.rot * p * Math.PI) / 180;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    [dx, dy] = [dx * c - dy * sn, dx * sn + dy * c];
  }
  return { x: cx + dx, y: cy + dy, s };
};

/** Camera that centers a world point living on layer p. */
export const lookAt = (wx: number, wy: number, p: number, zoom: number, rot = 0): Cam => ({
  x: wx / p,
  y: wy / p,
  zoom,
  rot,
});

export const mixCam = (a: Cam, b: Cam, t: number): Cam => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  // Zoom interpolates geometrically so pushes feel linear to the eye.
  zoom: a.zoom * Math.pow(b.zoom / a.zoom, t),
  rot: a.rot + (b.rot - a.rot) * t,
});

/** Handheld shake: layered simplex noise, amplitude in px, rotation in degrees. */
export const shake = (frame: number, amp: number, rotAmp: number, seed = 'shake') => ({
  x: (noise2D(seed + 'x', frame * 0.09, 0) + 0.45 * noise2D(seed + 'x2', frame * 0.31, 3)) * amp,
  y: (noise2D(seed + 'y', 0, frame * 0.09) + 0.45 * noise2D(seed + 'y2', 7, frame * 0.31)) * amp,
  r: noise2D(seed + 'r', frame * 0.07, 11) * rotAmp,
});

/** Depth-of-field blur for a layer, in px. */
export const dofBlur = (p: number, focusP: number, strength: number, zoom: number) =>
  Math.min(26, Math.abs(p - focusP) * strength * 55 * Math.max(1, zoom));
