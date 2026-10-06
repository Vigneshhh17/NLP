import type { DosageInfo } from './types';

const STRENGTH_RE = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|ug|g|kg|ml|mL|IU|units?|%)/gi;
const FORM_RE = /\b(tablet|tab|capsule|cap|syrup|syp|injection|inj|suspension|susp|cream|gel|ointment|drop|drops|solution|sol|powder|sachet|spray|inhaler)\b/i;
const FREQ_RE = /\b(OD|BD|BID|TID|TDS|QID|QDS|QHS|HS|PRN|SOS|STAT|nocte|mane|q\d+h|every\s+\d+\s*(?:h|hr|hrs|hours?|days?)|once\s+daily|twice\s+daily|thrice\s+daily)\b/i;
const ROUTE_RE = /\b(oral|PO|IV|IM|SC|subcut|topical|inhalation|inhaled|nasal|ophthalmic|otic|rectal|PR)\b/i;

/**
 * Search a wide window on BOTH sides of the mention for dosage info.
 * Picks the strength match closest to the mention.
 */
export function extractDosage(
  text: string,
  mentionStart: number,
  mentionEnd: number
): DosageInfo | undefined {
  const from = Math.max(0, mentionStart - 45);
  const to = Math.min(text.length, mentionEnd + 30);
  const win = text.slice(from, to);

  const out: DosageInfo = {};

  // Collect all strength matches with distance from mention centre
  const mentionCenter = (mentionStart + mentionEnd) / 2;
  let best: { distance: number; value: number; unit: string } | null = null;

  STRENGTH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STRENGTH_RE.exec(win)) !== null) {
    const globalStart = from + m.index;
    const globalCenter = globalStart + m[0].length / 2;
    const distance = Math.abs(globalCenter - mentionCenter);
    const value = parseFloat(m[1].replace(',', '.'));
    const unit = m[2];
    if (!best || distance < best.distance) {
      best = { distance, value, unit };
    }
  }

  if (best) {
    out.strength = `${best.value} ${best.unit}`;
    out.strengthValue = best.value;
    out.strengthUnit = best.unit;
  }

  const f = FORM_RE.exec(win); if (f) out.form = f[1].toLowerCase();
  const q = FREQ_RE.exec(win); if (q) out.frequency = q[1].toUpperCase();
  const r = ROUTE_RE.exec(win); if (r) out.route = r[1].toUpperCase();

  return Object.keys(out).length ? out : undefined;
}