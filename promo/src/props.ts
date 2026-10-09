import { z } from 'zod';
import { DEFAULT_PROSPECT } from './config';

/**
 * Input props for every composition. Edit them live in the Studio's props
 * panel, or pass a JSON file when rendering:
 *
 *   npx remotion render TeamMartPromo out/acme.mp4 --props=prospects/example-northgate.json
 */
export const promoSchema = z.object({
  /** 'en' = English, 'ckb' = Sorani Kurdish (right-to-left). */
  lang: z.enum(['en', 'ckb']),
  /** Burn in the caption track (for sound-off autoplay on social). */
  captions: z.boolean(),
  prospect: z.object({
    company: z.string(),
    zones: z
      .array(
        z.object({
          /** Leave empty for an automatic "Zone 1" / "ناوچەی 1" style name. */
          name: z.string(),
          markets: z.array(z.string()).min(1).max(6),
        }),
      )
      .min(2)
      .max(6),
    employeesPerMarket: z.number().int().min(2).max(6),
    focusZone: z.number().int().min(0),
    focusMarket: z.number().int().min(0),
    employee: z.string(),
  }),
});

export type PromoProps = z.infer<typeof promoSchema>;

export const defaultProps = (overrides: Partial<PromoProps> = {}): PromoProps => ({
  lang: 'en',
  captions: false,
  prospect: DEFAULT_PROSPECT,
  ...overrides,
});
