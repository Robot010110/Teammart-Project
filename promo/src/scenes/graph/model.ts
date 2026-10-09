import { COPY } from '../../config';

/**
 * Radial hierarchy: HQ → 3 Zones → 9 Markets → 36 Employees.
 *
 * Each ring lives on its own parallax plane (a shallow pyramid: HQ nearest
 * the camera, employees farthest), so any camera move reveals depth.
 * Zone 3 sits at the bottom (90°) — it is the Regional Manager's zone in the
 * workflow, and its middle market is the Supervisor's.
 */
export type Level = 0 | 1 | 2 | 3;

export const RADII = [0, 172, 322, 452] as const;
/** Parallax factor per level (see lib/camera.ts). */
export const DEPTH = [1.2, 1.11, 1.0, 0.9] as const;

export type GNode = {
  idx: number;
  level: Level;
  /** degrees, screen space (0 = right, 90 = down) */
  angle: number;
  r: number;
  x: number;
  y: number;
  parent: number;
  zone: number;
  market: number;
  /** clockwise order within its level, starting at 12 o'clock */
  order: number;
  label: string;
};

const ZONE_ANGLES = [210, 330, 90];

const polar = (r: number, deg: number) => ({ x: r * Math.cos((deg * Math.PI) / 180), y: r * Math.sin((deg * Math.PI) / 180) });

const clockwiseFromTop = (deg: number) => (((deg + 90) % 360) + 360) % 360;

const build = () => {
  const nodes: GNode[] = [];
  const add = (n: Omit<GNode, 'idx' | 'order' | 'x' | 'y'>) => {
    const p = polar(n.r, n.angle);
    nodes.push({ ...n, idx: nodes.length, order: 0, x: p.x, y: p.y });
    return nodes.length - 1;
  };
  const hq = add({ level: 0, angle: -90, r: 0, parent: -1, zone: -1, market: -1, label: COPY.structure.hq });
  let marketCount = 0;
  ZONE_ANGLES.forEach((za, z) => {
    const zi = add({ level: 1, angle: za, r: RADII[1], parent: hq, zone: z, market: -1, label: COPY.structure.zoneNames[z] });
    for (let k = 0; k < 3; k++) {
      const ma = za + (k - 1) * 40;
      marketCount += 1;
      const m = z * 3 + k;
      const mi = add({
        level: 2,
        angle: ma,
        r: RADII[2],
        parent: zi,
        zone: z,
        market: m,
        label: `${COPY.structure.marketPrefix}${String(marketCount).padStart(2, '0')}`,
      });
      for (let e = 0; e < 4; e++) {
        add({ level: 3, angle: ma + (e - 1.5) * 10, r: RADII[3], parent: mi, zone: z, market: m, label: '' });
      }
    }
  });
  // Clockwise build order per level.
  ([1, 2, 3] as Level[]).forEach((lv) => {
    nodes
      .filter((n) => n.level === lv)
      .sort((a, b) => clockwiseFromTop(a.angle) - clockwiseFromTop(b.angle))
      .forEach((n, i) => {
        n.order = i;
      });
  });
  return nodes;
};

export const NODES = build();

export const HQ = 0;
/** Zone 3 — the Regional Manager's zone in the workflow. */
export const RM_ZONE = NODES.find((n) => n.level === 1 && n.zone === 2)!.idx;
/** The middle market of Zone 3 — the Supervisor's market. */
export const SUP_MARKET = NODES.find((n) => n.level === 2 && n.zone === 2 && n.angle === 90)!.idx;

export const EDGES = NODES.filter((n) => n.parent >= 0).map((n) => ({ from: n.parent, to: n.idx, level: n.level }));

export const RM_SPAN = 60; // half-angle of a zone wedge
export const SUP_SPAN = 20; // half-angle of a market wedge

export { polar };
