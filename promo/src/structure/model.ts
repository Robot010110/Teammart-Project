/**
 * The org structure drawn by the film: HQ → zones → markets → employees,
 * laid out radially. Built from the prospect (config.ts or a prospect JSON),
 * so per-client versions show the client's own zones and markets.
 *
 * Pure module (no React) — the layout is plain math.
 */
import type { Prospect } from '../config.ts';

export type Level = 0 | 1 | 2 | 3;

/** Ring radii in world units (one unit ≈ one pixel at zoom 1 in the 2D overlays). */
export const RADII = [0, 172, 322, 452] as const;

export type GNode = {
  idx: number;
  level: Level;
  /** degrees on the disc (0 = +x, 90 = toward the viewer / screen-down) */
  angle: number;
  r: number;
  x: number;
  y: number;
  parent: number;
  zone: number;
  /** global market index, -1 above market level */
  market: number;
  /** clockwise order within its level, starting at 12 o'clock */
  order: number;
  label: string;
};

export type Structure = {
  nodes: GNode[];
  edges: { from: number; to: number; level: Level }[];
  hq: number;
  /** The Regional Manager's zone (placed at 90°, nearest the camera). */
  focusZone: number;
  /** The Supervisor's market inside it. */
  focusMarket: number;
  /** The employee who receives the task. */
  focusEmployee: number;
  zoneSpan: number;
  marketSpan: number;
  counts: { zones: number; markets: number; employees: number };
};

export const polar = (r: number, deg: number) => ({ x: r * Math.cos((deg * Math.PI) / 180), y: r * Math.sin((deg * Math.PI) / 180) });

const clockwiseFromTop = (deg: number) => (((deg + 90) % 360) + 360) % 360;

export const buildStructure = (
  prospect: Prospect,
  names: { hq: string; zone: (i: number) => string; market: (i: number) => string },
): Structure => {
  const nodes: GNode[] = [];
  const add = (n: Omit<GNode, 'idx' | 'order' | 'x' | 'y'>) => {
    const p = polar(n.r, n.angle);
    nodes.push({ ...n, idx: nodes.length, order: 0, x: p.x, y: p.y });
    return nodes.length - 1;
  };
  const Z = prospect.zones.length;
  const fz = Math.min(Math.max(0, prospect.focusZone), Z - 1);
  const zoneSpan = 360 / Z;
  const E = Math.min(6, Math.max(2, prospect.employeesPerMarket));

  const hq = add({ level: 0, angle: -90, r: 0, parent: -1, zone: -1, market: -1, label: names.hq });
  let globalMarket = 0;
  let focusMarket = -1;
  let focusEmployee = -1;
  let maxMarkets = 1;
  prospect.zones.forEach((zone, z) => {
    // The focus zone sits at 90° (nearest the camera); the rest follow clockwise.
    const za = 90 + (z - fz) * zoneSpan;
    const zi = add({ level: 1, angle: za, r: RADII[1], parent: hq, zone: z, market: -1, label: zone.name || names.zone(z) });
    const M = zone.markets.length;
    maxMarkets = Math.max(maxMarkets, M);
    const marketSpan = zoneSpan / M;
    zone.markets.forEach((marketName, k) => {
      const ma = za - zoneSpan / 2 + marketSpan * (k + 0.5);
      const mi = add({ level: 2, angle: ma, r: RADII[2], parent: zi, zone: z, market: globalMarket, label: marketName || names.market(globalMarket) });
      const fm = Math.min(Math.max(0, prospect.focusMarket), M - 1);
      if (z === fz && k === fm) focusMarket = mi;
      const empSpan = marketSpan * 0.78;
      for (let e = 0; e < E; e++) {
        const ea = ma - empSpan / 2 + (empSpan * (e + 0.5)) / E;
        const ei = add({ level: 3, angle: ea, r: RADII[3], parent: mi, zone: z, market: globalMarket, label: '' });
        // The employee nearest the camera receives the task.
        if (mi === focusMarket && e === Math.floor(E / 2)) focusEmployee = ei;
      }
      globalMarket += 1;
    });
  });

  ([1, 2, 3] as Level[]).forEach((lv) => {
    nodes
      .filter((n) => n.level === lv)
      .sort((a, b) => clockwiseFromTop(a.angle) - clockwiseFromTop(b.angle))
      .forEach((n, i) => {
        n.order = i;
      });
  });

  return {
    nodes,
    edges: nodes.filter((n) => n.parent >= 0).map((n) => ({ from: n.parent, to: n.idx, level: n.level })),
    hq,
    focusZone: nodes.find((n) => n.level === 1 && n.zone === fz)!.idx,
    focusMarket,
    focusEmployee,
    zoneSpan,
    marketSpan: zoneSpan / maxMarkets,
    counts: { zones: Z, markets: globalMarket, employees: globalMarket * E },
  };
};
