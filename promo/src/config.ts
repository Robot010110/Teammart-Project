/**
 * ─────────────────────────────────────────────────────────────────────────
 *  TeamMart promo — the one file to edit.
 *
 *  COLORS            palette (from ../../brand/tokens.mjs, shared with the app)
 *  DEFAULT_PROSPECT  the org structure shown in the film (zones, markets…).
 *                    Per-client versions override it with a JSON file —
 *                    see prospects/ and the README.
 *  COPY              every English word on screen. {zone}, {market},
 *                    {employee} and {company} are filled from the prospect.
 *                    Kurdish lives in src/i18n/ckb.ts with the same shape.
 *  CAPTIONS          burned-in caption lines per edit (40 s / 15 s / 6 s)
 *  TIMING            scene lengths in seconds for the 40 s master
 *  LOOK / AUDIO      grain, blur, 3D quality, soundtrack levels
 * ─────────────────────────────────────────────────────────────────────────
 */
import { BRAND } from '../../brand/tokens.mjs';

const B = BRAND.colors;

export const COLORS = {
  /** Near-black canvas. */
  bg: B.night,
  /** Brand blue — identity, data, focus. The film's electric accent. */
  accent: B.blue,
  accentSoft: B.blueSoft,
  accentDeep: B.blueDeep,
  /** Brand orange — action and alerts (the app's primary button color). */
  warm: B.orange,
  warmDeep: B.orangeDeep,
  text: B.text,
  textDim: B.textDim,
  textFaint: B.textFaint,
  danger: B.red,
  success: B.green,

  /** In-product UI tokens (the phone mockups match the real app). */
  app: {
    bg: '#0A0F1C',
    card: B.ink,
    cardBorder: 'rgba(255,255,255,0.08)',
    navy: B.navy,
    orange: B.orange,
    text: '#F2F4F8',
    textDim: '#8B93A8',
    green: B.green,
  },
};

export type ProspectZone = { name: string; markets: string[] };
export type Prospect = {
  /** Shown as "Prepared for …" at the close. Empty = hidden. */
  company: string;
  zones: ProspectZone[];
  /** Employee dots drawn per market (2–6). */
  employeesPerMarket: number;
  /** Index of the zone the workflow zooms into (the Regional Manager's). */
  focusZone: number;
  /** Index, inside that zone, of the Supervisor's market. */
  focusMarket: number;
  /** Name on the employee node that receives the task. */
  employee: string;
};

export const DEFAULT_PROSPECT: Prospect = {
  company: '',
  // Empty names are filled per language: "Zone 1", "Market 7", …
  zones: [
    { name: '', markets: ['', '', ''] },
    { name: '', markets: ['', '', ''] },
    { name: '', markets: ['', '', ''] },
  ],
  employeesPerMarket: 4,
  focusZone: 2,
  focusMarket: 1,
  employee: 'Shalaw N.',
};

export type CaptionLine = { from: number; to: number; text: string };

export const COPY = {
  chaos: {
    hero: "who's covering {zone}?",
    bubbles: [
      'Shelf 4 is empty AGAIN',
      'did anyone check the dairy chiller??',
      "I'm off sick today, sorry",
      'can someone swap my Thursday shift',
      "where's the delivery manifest",
      'who approved this price change?',
      'supervisor not picking up',
      'is {market} still closed?',
      'pls send a photo when done',
      '??',
      'call me asap',
      'which schedule is the right one',
      'nobody told me',
    ],
    senders: ['Ahmed · {market}', 'Sara · Cashier', 'Soran · Night shift', 'Rostam · Market 2'],
    heroSender: 'Area Manager · now',
    notes: ['Restock dairy!!', 'Call Ahmed re: shift', '{zone} — WHO?', 'Expired items → ?', 'Inventory Fri??', 'Fix price tags A5', 'Ask HQ'],
    emails: ['RE: RE: FW: shift_schedule_v7_FINAL(2).xlsx', 'URGENT: inventory count (again)', 'Fwd: who has the keys?'],
    emailSender: 'Area Ops · 07:42',
    missedCalls: ['Missed call · {market}', 'Missed call · Supervisor', 'Missed call · Unknown'],
    missedCounterLabel: 'missed calls',
    sheetName: 'shift_schedule_v7_FINAL(2).xlsx',
    sheetHeader: ['Shift', 'Zone', 'Cover'],
    sheetRows: [
      ['06–14', 'Z3', '???'],
      ['14–22', 'Z3', '#REF!'],
      ['22–06', 'Z1', 'TBD'],
    ],
    badges: ['99+', '27', '12', '!', '47'],
    misc: ['Late: 4 staff', 'Overdue', 'Unread (47)'],
  },

  beat: {
    /** One array per line on 16:9. */
    lines: [
      ['What', 'if', 'every', 'market'],
      ['ran', 'like', 'one', 'team?'],
    ],
    /** The same words, broken for portrait and square frames. */
    portraitLines: [['What', 'if'], ['every', 'market'], ['ran', 'like'], ['one', 'team?']],
    /** Words drawn in the accent color. */
    highlight: ['one', 'team?'],
  },

  structure: {
    levels: ['Zones', 'Markets', 'Employees'],
    hq: 'HQ',
    zonePattern: 'Zone {n}',
    marketPattern: 'Market {n}',
    subtitle: 'Every role sees exactly what it owns.',
    roles: [
      { key: 'admin', title: 'Admin', scope: 'Every zone, every market' },
      { key: 'rm', title: 'Regional Manager', scope: 'Their zones only' },
      { key: 'supervisor', title: 'Supervisor', scope: 'One market and its team' },
    ],
  },

  workflow: {
    steps: ['Assign', 'Complete', 'Approve'],
    stepDetails: [
      'A Supervisor sends a task straight to the right person.',
      'They complete it on their phone, with photo proof.',
      'Logged work comes back to the Supervisor — approved in one tap.',
    ],
    task: {
      title: 'Restock dairy shelf',
      category: 'Restocking',
      location: 'Aisle 4 · Dairy',
      priority: 'High',
      due: 'Due in 30 min',
    },
    assignedBy: 'Supervisor',
    assignee: '{employee}',
    approvedLabel: 'Approved',
    approvedDetail: 'Visible to {zone} and HQ',
    /** On the phones in S4. {speed} = how much the screen recording is sped up. */
    realBadge: 'Real app · demo data · {speed}× speed',
  },

  dashboard: {
    title: 'Operations overview',
    live: 'Live',
    /** Shown on the dashboard so the sample figures are never mistaken for claims. */
    dataTag: 'Illustrative data',
    kpis: [
      { label: 'Markets online', value: 12, suffix: '' },
      { label: 'Team on shift', value: 184, suffix: '' },
      { label: 'Tasks completed', value: 1248, suffix: '' },
      { label: 'Avg. approval time', value: 14, suffix: 'm' },
    ],
    chart: {
      title: 'Tasks completed · this week',
      range: 'Mon – Sun',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      values: [148, 172, 161, 198, 214, 236, 252],
    },
    ringsTitle: 'Completion today',
    rings: [
      { label: 'Tasks', value: 0.92 },
      { label: 'Attendance', value: 0.87 },
      { label: 'Checklists', value: 0.76 },
    ],
    bars: {
      title: 'Completion by market',
      values: [0.82, 0.91, 0.74, 0.88, 0.95, 0.69, 0.86, 0.79, 0.93],
    },
    feedTitle: 'Live activity',
    feed: [
      { text: 'Shelf restock approved', where: 'Market 03', time: '2m' },
      { text: 'Shift swap confirmed', where: 'Zone 1', time: '4m' },
      { text: 'Price labels fixed', where: 'Market 07', time: '6m' },
      { text: 'Cleaning checklist done', where: 'Market 05', time: '9m' },
    ],
    liveItem: { text: 'Restock dairy shelf · Approved', where: '{zone}', time: 'now' },
  },

  reveal: {
    caption: 'Real screens from the TeamMart app · demo data',
    admin: 'Admin',
    devices: ['Regional Manager', 'Supervisor', 'Employee'],
    browserTitle: 'TeamMart — Admin dashboard',
  },

  close: {
    wordmark: ['Team', 'Mart'],
    tagline: 'Run every market like one team.',
    cta: 'Book a demo',
    /** Optional line under the CTA, e.g. 'teammart.app'. Leave empty to hide. */
    url: '',
    preparedFor: 'Prepared for {company}',
  },

  /**
   * Burned-in captions, written for sound-off autoplay: they carry the story
   * where the picture has no words of its own and stay quiet while on-screen
   * type is already talking. Seconds on each edit's own timeline.
   */
  captions: {
    full: [
      { from: 0.4, to: 2.9, text: 'This is a normal morning in retail.' },
      { from: 3.1, to: 5.8, text: "Calls, chats, spreadsheets — and nobody's sure who's covering." },
      { from: 9.4, to: 12.9, text: 'TeamMart maps your whole operation.' },
      { from: 12.9, to: 15.8, text: 'Every role gets its own clear view.' },
      { from: 27.4, to: 31.3, text: 'Every market, live, on one screen.' },
      { from: 31.9, to: 34.8, text: 'Built on the real TeamMart app.' },
    ] as CaptionLine[],
    cut15: [
      { from: 0.3, to: 3.0, text: "Calls, chats, spreadsheets — and nobody's sure who's covering." },
      { from: 5.6, to: 7.9, text: 'TeamMart puts every market on one team.' },
      { from: 8.2, to: 11.9, text: 'Tasks assigned, done with photo proof, approved.' },
    ] as CaptionLine[],
    cut6: [{ from: 0.2, to: 1.9, text: "Nobody's sure who's covering?" }] as CaptionLine[],
  },
};

export type Copy = typeof COPY;

/** Real material captured from the running TeamMart app (see README). */
export const SCREENS = {
  admin: 'screens/{lang}/admin-dashboard.png',
  regionalManager: 'screens/{lang}/regional-manager-home.png',
  supervisor: 'screens/{lang}/supervisor-home.png',
  employee: 'screens/{lang}/employee-tasks.png',
  /**
   * Screen recordings of the real flow, played inside the phones in S4
   * (made by scripts/record-flows.cjs, which also writes their key moments
   * to src/recordings/events.json).
   */
  supervisorAssigns: 'recordings/{lang}/supervisor-assigns.mp4',
  employeeCompletes: 'recordings/{lang}/employee-completes-task.mp4',
  supervisorApproves: 'recordings/{lang}/supervisor-approves.mp4',
};

export const TIMING = {
  fps: 60,
  /** Seconds per scene of the 40 s master. Cutdowns are edits of it (src/timeline/edits.ts). */
  scenes: {
    chaos: 6,
    beat: 3,
    structure: 7,
    workflow: 11,
    dashboard: 8,
    close: 5,
  },
};

export const LOOK = {
  /** Film grain strength (0 = off). */
  grain: 0.065,
  /** Edge darkening (0 = off). */
  vignette: 0.6,
  /** Directional, velocity-based motion blur on fast DOM moves. */
  motionBlur: true,
  /** 180° = classic film shutter. Higher = longer smears. */
  shutterAngle: 180,
  /** Cap on blur length in px so very fast moves stay legible. */
  maxBlurPx: 34,
  /** Frames of fade-to-black at the very end of each edit (0 = hard end). */
  fadeOutFrames: 12,
  /**
   * 3D hierarchy: most sub-frame samples for real motion blur (1 = off,
   * 6 = film-like). Each frame uses only as many as its motion needs.
   */
  motionBlurSamples3d: 6,
  /**
   * 3D hierarchy: internal resolution (1 = full). Its labels, phones and
   * type are DOM and stay sharp; 0.75 renders ~1.8× faster on CPU-only machines.
   */
  scale3d: 0.75,
  /** 3D hierarchy: bloom strength. */
  bloom: 0.8,
};

export const AUDIO = {
  /** Play the generated soundtrack (public/audio/, made by `npm run audio`). */
  enabled: true,
  masterVolume: 1,
};
