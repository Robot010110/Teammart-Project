/**
 * ─────────────────────────────────────────────────────────────────────────
 *  TeamMart promo — the one file to edit.
 *
 *  COLORS  → brand palette (promo frame) + the real app's tokens (phone UI)
 *  COPY    → every word that appears on screen
 *  TIMING  → scene lengths in seconds (the choreography inside each scene
 *            scales to fit, so you can lengthen/shorten any scene safely)
 *  LOOK    → grain, vignette, motion blur, fade-out
 *  SFX     → turn on once you've dropped audio files into public/sfx/
 * ─────────────────────────────────────────────────────────────────────────
 */

export const COLORS = {
  /** Near-black canvas. */
  bg: '#0A0B10',
  /** The one electric accent. */
  accent: '#4F7CFF',
  /** Lighter tint of the accent for secondary highlights. */
  accentSoft: '#9BB3FF',
  /** Warm secondary — reserved for alerts and urgency. */
  warm: '#FFB547',
  text: '#F4F6FB',
  textDim: '#A3ABBF',
  textFaint: '#626A80',
  danger: '#FF5D6C',

  /**
   * In-product UI. The phone mockups use TeamMart's real design tokens
   * (Frontend/tailwind.config.js) so the animated UI matches the real
   * screenshots that appear later in the film.
   */
  app: {
    bg: '#0A0F1C',
    card: '#111A2E',
    cardBorder: 'rgba(255,255,255,0.08)',
    navy: '#1D2D5C',
    orange: '#F47A20',
    text: '#F2F4F8',
    textDim: '#8B93A8',
    green: '#34D399',
  },
} as const;

export const COPY = {
  chaos: {
    hero: "who's covering Zone 3?",
    bubbles: [
      'Shelf 4 is empty AGAIN',
      'did anyone check the dairy chiller??',
      "I'm off sick today, sorry",
      'can someone swap my Thursday shift',
      "where's the delivery manifest",
      'who approved this price change?',
      'supervisor not picking up',
      'is Market 7 still closed?',
      'pls send a photo when done',
      '??',
      'call me asap',
      'which schedule is the right one',
      'nobody told me',
    ],
    notes: ['Restock dairy!!', 'Call Ahmed re: shift', 'Zone 3 — WHO?', 'Expired items → ?', 'Inventory Fri??', 'Fix price tags A5', 'Ask HQ'],
    emails: ['RE: RE: FW: shift_schedule_v7_FINAL(2).xlsx', 'URGENT: inventory count (again)', 'Fwd: who has the keys?'],
    missedCalls: ['Missed call · Market 7', 'Missed call · Supervisor', 'Missed call · Unknown'],
    missedCounterLabel: 'missed calls',
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
    /** One array per line on 16:9. The vertical cut re-wraps these words automatically. */
    lines: [
      ['What', 'if', 'every', 'market'],
      ['ran', 'like', 'one', 'team?'],
    ],
    /** Words drawn in the accent color. */
    highlight: ['one', 'team?'],
  },

  structure: {
    levels: ['Zones', 'Markets', 'Employees'],
    hq: 'HQ',
    zoneNames: ['Zone 1', 'Zone 2', 'Zone 3'],
    marketPrefix: 'M',
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
      'A Regional Manager sends the task straight to the right market.',
      'The Supervisor gets it on their phone, does it, adds a photo.',
      'One tap to approve. Everyone can see it is done.',
    ],
    task: {
      title: 'Restock dairy shelf',
      category: 'Restocking',
      location: 'Aisle 4 · Dairy',
      priority: 'High',
      due: 'Due in 30 min',
      dueTime: 'Today, 2:45 PM',
      description: 'Dairy chiller is running low. Pull anything near expiry, restock, and attach a photo.',
    },
    assignedBy: 'Regional Manager',
    assignee: 'Supervisor',
    notification: 'New task assigned',
    approveButton: 'Approve',
    approvedLabel: 'Approved',
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
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      values: [148, 172, 161, 198, 214, 236, 252],
    },
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
    liveItem: { text: 'Restock dairy shelf · Approved', where: 'Zone 3', time: 'now' },
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
  },
} as const;

/** Real screenshots captured from the running TeamMart app (see README). */
export const SCREENS = {
  admin: 'screens/admin-dashboard.png',
  regionalManager: 'screens/regional-manager-home.png',
  supervisor: 'screens/supervisor-home.png',
  employee: 'screens/employee-tasks.png',
} as const;

export const TIMING = {
  fps: 60,
  /** Seconds per scene. Default total = 40 s. */
  scenes: {
    chaos: 6,
    beat: 3,
    structure: 8,
    workflow: 10,
    dashboard: 8,
    close: 5,
  },
};

export const LOOK = {
  /** Film grain strength (0 = off). */
  grain: 0.065,
  /** Edge darkening (0 = off). */
  vignette: 0.6,
  /** Directional, velocity-based motion blur on fast moves. */
  motionBlur: true,
  /** 180° = classic film shutter. Higher = longer smears. */
  shutterAngle: 180,
  /** Cap on blur length in px so very fast moves stay legible. */
  maxBlurPx: 34,
  /** Frames of fade-to-black at the very end (0 = hard end on the logo). */
  fadeOutFrames: 12,
};

export const SFX = {
  /**
   * Off by default: the cue sheet lives in src/sfx.ts and every cue is also
   * marked in the scene code. Drop matching files into public/sfx/ and flip
   * this to true to hear them in the Studio and in renders.
   */
  enabled: false,
  masterVolume: 0.9,
};
