import { extractMentions } from './ner';
import { lookupPair, getProfile } from './ddi';
import { checkAllDoses } from './dose-safety';
import { getIndex } from './drug-index';
import type { AnalysisResult } from './types';

export async function analyze(text: string): Promise<AnalysisResult> {
  const t0 = Date.now();
  const warnings: string[] = [];
  const bundle = await getIndex();

  if (!text || !text.trim()) {
    return {
      text: text || '',
      mentions: [],
      pairs: [],
      doseAlerts: [],
      warnings: ['No input provided.'],
      meta: { durationMs: Date.now() - t0, recordCount: bundle.records.length }
    };
  }

  const mentions = await extractMentions(text);
  const doseAlerts = checkAllDoses(mentions);

  if (!mentions.length) {
    warnings.push('No medications recognized in the input.');
  }

  const pairs: AnalysisResult['pairs'] = [];
  for (let i = 0; i < mentions.length; i++) {
    for (let j = i + 1; j < mentions.length; j++) {
      const a = mentions[i];
      const b = mentions[j];
      const interactions = lookupPair(a, b);
      if (interactions.length || (a.matchedRecord && b.matchedRecord)) {
        pairs.push({
          a: a.matchedRecord ? a.matchedRecord.name : a.text,
          b: b.matchedRecord ? b.matchedRecord.name : b.text,
          aStatus: a.context.label,
          bStatus: b.context.label,
          interactions,
          aProfile: a.genericIngredients[0] ? getProfile(a.genericIngredients[0]) : undefined,
          bProfile: b.genericIngredients[0] ? getProfile(b.genericIngredients[0]) : undefined
        });
      }
    }
  }

  for (const m of mentions) {
    if (m.context.label !== 'current') {
      warnings.push(
        '"' + m.text + '" is marked as ' + m.context.label +
        '; interaction checks were still computed but flag may not reflect active therapy.'
      );
    }
  }

  return {
    text,
    mentions,
    pairs,
    doseAlerts,
    warnings,
    meta: { durationMs: Date.now() - t0, recordCount: bundle.records.length }
  };
}