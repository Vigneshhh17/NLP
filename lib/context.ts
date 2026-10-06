import type { ContextInfo } from './types';

const NEGATORS = [
  'no','not','non',"isn't","aren't","wasn't","weren't","doesn't","don't",
  'denies','denied','without','never','negative','nil','none','nor','neither'
];
const HISTORICAL = [
  'discontinued','stopped','ceased','past','previous','previously',
  'history of','h/o','former','prior','had been','was on','used to'
];
const HYPOTHETICAL = [
  'if','would','could','should','may','might','consider','plan',
  'contemplate','recommend','avoid'
];

function hasAny(haystack: string, needles: string[]): boolean {
  for (const n of needles) {
    const re = new RegExp(
      '(?:^|\\W)' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\W|$)',
      'i'
    );
    if (re.test(haystack)) return true;
  }
  return false;
}

/** Find the start of the sentence that contains `pos`. */
function sentenceStart(text: string, pos: number): number {
  for (let i = pos - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === ';' || ch === '\n') {
      return i + 1;
    }
  }
  return 0;
}

/**
 * Detect negation / historical / hypothetical context.
 * Scope: only the current sentence, so "denies X. Discontinued Y." doesn't
 * mark Y as negated.
 */
export function detectContext(text: string, start: number, end: number): ContextInfo {
  const sStart = sentenceStart(text, start);
  const pre = text.slice(sStart, start).toLowerCase().trim();

  const negated = hasAny(pre, NEGATORS);
  const historical = hasAny(pre, HISTORICAL);
  const hypothetical = hasAny(pre, HYPOTHETICAL);

  let label: ContextInfo['label'] = 'current';
  if (negated) label = 'negated';
  else if (historical) label = 'historical';
  else if (hypothetical) label = 'hypothetical';

  return { negated, historical, hypothetical, label };
}