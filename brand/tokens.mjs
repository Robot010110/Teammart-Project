/**
 * TeamMart brand tokens — the single source of truth for color. The promo
 * imports this file (promo/src/config.ts) and brand/tools/build.py reads it
 * for the logo artwork. The app keeps a mirror in Frontend/tailwind.config.js
 * (`brand-*` colors) so its build stays self-contained — keep the two in sync.
 *
 * Roles (see brand/README.md):
 *   blue    → identity: the logo, data, focus, links, "live" states
 *   orange  → action: primary buttons, priority, alerts
 *   night / ink / navy → surfaces, from canvas to raised cards
 */
export const BRAND = {
  name: 'TeamMart',
  colors: {
    night: '#0A0B10',
    ink: '#111A2E',
    navy: '#1D2D5C',
    blue: '#4F7CFF',
    blueSoft: '#9BB3FF',
    blueDeep: '#2F4FCC',
    orange: '#F47A20',
    orangeDeep: '#C95C10',
    green: '#34D399',
    red: '#FF5D6C',
    text: '#F4F6FB',
    textDim: '#A3ABBF',
    textFaint: '#626A80',
  },
};
