import { candidatesFor, recordAt, recordsForIngredient, getIndex, type IndexBundle } from './drug-index';
import { parseComposition, aliasToIngredients } from './normalize';
import { extractDosage } from './dosage';
import { detectContext } from './context';
import type { DrugMention, DrugRecord } from './types';

interface Tok { t: string; s: number; e: number; }

const WORD_RE = /[A-Za-z][A-Za-z0-9\-']*/g;

// Words that act as segment boundaries: never include them in a drug span.
const BOUNDARY = new Set([
  // connectives
  'and','with','plus','or','also','then','by','from','at','in','on','of','to','for',
  // verbs / subjects that precede drugs
  'is','was','are','were','has','have','had','taking','takes','take','started','stopped',
  'discontinued','denies','denied','began','prescribed','given','receiving','uses','using',
  'patient','pt','he','she','they','we','i',
  // negation
  'no','not','never','without','none','nil','negative',
  // numbers spelled out
  'one','two','three','four','five','six','seven','eight','nine','ten',
  // time units
  'day','days','week','weeks','month','months','year','years','hour','hours','ago'
]);

// Filtered from being considered as the "primary" token in an n-gram
const STOP = new Set([
  'the','a','an','and','or','of','for','to','is','was','are','patient','with','on',
  'taking','takes','take','started','given','were','has','have','had','also','plus',
  'then','than','this','that','these','those','by','from','at','in'
]);

const CLINICAL_NOISE = new Set([
  'mg','mcg','ml','g','iu','tablet','tablets','capsule','capsules','bd','bid','tid',
  'tds','qid','qds','od','hs','prn','sos'
]);

function tokens(text: string): Tok[] {
  const out: Tok[] = [];
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    out.push({ t: m[0], s: m.index, e: m.index + m[0].length });
  }
  return out;
}

function cleanToken(t: string): boolean {
  const lt = t.toLowerCase();
  if (lt.length < 2) return false;
  if (STOP.has(lt) || CLINICAL_NOISE.has(lt) || BOUNDARY.has(lt)) return false;
  if (/^\d+$/.test(lt)) return false;
  return true;
}

/** Split tokens into segments at boundary words. */
function segmentize(toks: Tok[]): Tok[][] {
  const segs: Tok[][] = [];
  let cur: Tok[] = [];
  for (const t of toks) {
    if (BOUNDARY.has(t.t.toLowerCase())) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else {
      cur.push(t);
    }
  }
  if (cur.length) segs.push(cur);
  return segs;
}

function matchSpan(span: string, bundle: IndexBundle):
  | { kind: DrugMention['matchKind']; score: number; record?: DrugRecord; ingredients: string[] }
  | null {
  const spanLower = span.toLowerCase().trim();

  // 1) Dataset name match
  const cands = candidatesFor(span, bundle);
  if (cands.length) {
    let best: { record: DrugRecord; score: number } | null = null;
    for (const idx of cands.slice(0, 50)) {
      const rec = recordAt(idx, bundle);
      const nameLower = rec.name.toLowerCase();
      let score = 0;
      if (nameLower === spanLower) score = 0.98;
      else if (nameLower.startsWith(spanLower + ' ') || nameLower.endsWith(' ' + spanLower)) score = 0.92;
      else if (nameLower.includes(spanLower)) score = 0.82;
      else score = 0.62;
      score = score * (1 - Math.min(0.3, Math.abs(nameLower.length - spanLower.length) / 200));
      if (!best || score > best.score) best = { record: rec, score };
    }
    if (best && best.score >= 0.55) {
      const ings = parseComposition(best.record.composition);
      return { kind: 'dataset-name', score: best.score, record: best.record, ingredients: ings };
    }
  }

  // 2) Ingredient lookup
  const ingRecords = recordsForIngredient(spanLower, bundle);
  if (ingRecords.length) {
    const rec = recordAt(ingRecords[0], bundle);
    return { kind: 'dataset-ingredient', score: 0.85, record: rec, ingredients: [spanLower] };
  }

  // 3) Alias fallback — then try to find a dataset record for the ingredient
  const al = aliasToIngredients(spanLower);
  if (al.length) {
    let record: DrugRecord | undefined;
    for (const ing of al) {
      const recs = recordsForIngredient(ing, bundle);
      if (recs.length) { record = recordAt(recs[0], bundle); break; }
    }
    return { kind: 'alias', score: 0.72, record, ingredients: al };
  }

  return null;
}

export async function extractMentions(text: string): Promise<DrugMention[]> {
  const bundle = await getIndex();
  const toks = tokens(text);
  const segs = segmentize(toks);
  const mentions: DrugMention[] = [];

  for (const seg of segs) {
    const claimed: boolean[] = new Array(seg.length).fill(false);

    // longest n-grams first
    for (let n = Math.min(4, seg.length); n >= 1; n--) {
      for (let i = 0; i + n <= seg.length; i++) {
        const window = seg.slice(i, i + n);
        // all tokens in window must be unclaimed
        let overlaps = false;
        for (let k = i; k < i + n; k++) if (claimed[k]) { overlaps = true; break; }
        if (overlaps) continue;
        // must contain at least one "clean" token (not pure noise)
        if (!window.some((w) => cleanToken(w.t))) continue;

        const span = text.slice(window[0].s, window[window.length - 1].e);
        const m = matchSpan(span, bundle);
        if (!m) continue;

        const ctx = detectContext(text, window[0].s, window[window.length - 1].e);
        const dosage = extractDosage(text, window[0].s, window[window.length - 1].e);

        for (let k = i; k < i + n; k++) claimed[k] = true;

        mentions.push({
          text: span,
          start: window[0].s,
          end: window[window.length - 1].e,
          matchKind: m.kind,
          matchScore: m.score,
          matchedRecord: m.record,
          genericIngredients: m.ingredients,
          dosage,
          context: ctx
        });
      }
    }
  }

  mentions.sort((a, b) => a.start - b.start);
  return mentions;
}