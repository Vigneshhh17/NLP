import fs from 'node:fs';
import path from 'node:path';
import type { DrugMention, InteractionHit, DrugProfile } from './types';

interface KBEntry {
  a: string;
  b: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  effect: string;
  mechanism: string;
  recommendation: string;
}
interface KB { version: string; interactions: KBEntry[]; }

interface ClassDef { label: string; members: string[]; }
interface ClassRule {
  classes: [string, string];
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  effect: string;
  mechanism: string;
  recommendation: string;
}
interface ClassKB {
  version: string;
  classes: Record<string, ClassDef>;
  class_interactions: ClassRule[];
}

interface Loaded {
  pairMap: Map<string, KBEntry[]>;
  classKB: ClassKB;
  ingredientToClasses: Map<string, string[]>;
  classRules: Array<{ key: string; rule: ClassRule }>;
}

let cache: Loaded | null = null;

function pkey(a: string, b: string) {
  return a < b ? (a + '|' + b) : (b + '|' + a);
}

function load(): Loaded {
  if (cache) return cache;

  const pairFile = path.join(process.cwd(), 'data', 'ddi-kb.json');
  const classFile = path.join(process.cwd(), 'data', 'drug-classes.json');

  const pairKB: KB = JSON.parse(fs.readFileSync(pairFile, 'utf8'));
  const classKB: ClassKB = JSON.parse(fs.readFileSync(classFile, 'utf8'));

  const pairMap = new Map<string, KBEntry[]>();
  for (const e of pairKB.interactions) {
    const k = pkey(e.a.toLowerCase().trim(), e.b.toLowerCase().trim());
    const arr = pairMap.get(k);
    if (arr) arr.push(e); else pairMap.set(k, [e]);
  }

  const ingredientToClasses = new Map<string, string[]>();
  for (const [classId, def] of Object.entries(classKB.classes)) {
    for (const member of def.members) {
      const k = member.toLowerCase().trim();
      const arr = ingredientToClasses.get(k);
      if (arr) arr.push(classId); else ingredientToClasses.set(k, [classId]);
    }
  }

  const classRules: Array<{ key: string; rule: ClassRule }> = [];
  for (const r of classKB.class_interactions) {
    classRules.push({ key: pkey(r.classes[0], r.classes[1]), rule: r });
  }

  cache = { pairMap, classKB, ingredientToClasses, classRules };
  return cache;
}

const SEVERITY_RANK: Record<InteractionHit['severity'], number> = {
  contraindicated: 4, major: 3, moderate: 2, minor: 1, unknown: 0
};
export function severityRank(s: InteractionHit['severity']): number {
  return SEVERITY_RANK[s] ?? 0;
}

export function getProfile(ingredient: string): DrugProfile {
  const { classKB, ingredientToClasses } = load();
  const ids = ingredientToClasses.get(ingredient.toLowerCase().trim()) || [];
  return {
    ingredient,
    classes: ids.map((id) => ({ id, label: classKB.classes[id]?.label || id }))
  };
}

export function lookupPair(a: DrugMention, b: DrugMention): InteractionHit[] {
  const { pairMap, classKB, ingredientToClasses, classRules } = load();
  const A = new Set(a.genericIngredients);
  const B = new Set(b.genericIngredients);
  const hits: InteractionHit[] = [];
  const seenPairKeys = new Set<string>();

  // Layer 1: exact ingredient pair
  for (const ai of A) {
    for (const bi of B) {
      if (ai === bi) continue;
      const k = pkey(ai, bi);
      if (seenPairKeys.has(k)) continue;
      const entries = pairMap.get(k);
      if (!entries) continue;
      seenPairKeys.add(k);
      for (const e of entries) {
        let conf = 0.75;
        if (a.matchKind === 'dataset-name' || a.matchKind === 'dataset-ingredient') conf += 0.15;
        if (b.matchKind === 'dataset-name' || b.matchKind === 'dataset-ingredient') conf += 0.15;
        if (a.matchKind === 'alias') conf -= 0.05;
        if (b.matchKind === 'alias') conf -= 0.05;
        conf = Math.min(0.99, Math.max(0.4, conf));
        hits.push({
          a: ai, b: bi,
          severity: e.severity,
          effect: e.effect,
          mechanism: e.mechanism,
          recommendation: e.recommendation,
          aIngredients: [...A],
          bIngredients: [...B],
          confidence: Number(conf.toFixed(2)),
          source: 'ingredient-pair-kb'
        });
      }
    }
  }

  // Layer 2: class → class rules
  const classRuleDedup = new Set<string>();
  for (const ai of A) {
    const aClasses = ingredientToClasses.get(ai) || [];
    for (const bi of B) {
      if (ai === bi) continue;
      const bClasses = ingredientToClasses.get(bi) || [];
      for (const ca of aClasses) {
        for (const cb of bClasses) {
          if (ca === cb) continue;
          const ruleKey = pkey(ca, cb);
          const ingredientPairKey = pkey(ai, bi);
          if (seenPairKeys.has(ingredientPairKey)) continue;
          const dedupKey = ca + '|' + cb + '|' + ai + '|' + bi;
          if (classRuleDedup.has(dedupKey)) continue;
          classRuleDedup.add(dedupKey);

          for (const { key, rule } of classRules) {
            if (key !== ruleKey) continue;
            const caLabel = classKB.classes[ca]?.label || ca;
            const cbLabel = classKB.classes[cb]?.label || cb;
            let conf = 0.62;
            if (a.matchKind === 'dataset-name' || a.matchKind === 'dataset-ingredient') conf += 0.1;
            if (b.matchKind === 'dataset-name' || b.matchKind === 'dataset-ingredient') conf += 0.1;
            conf = Math.min(0.9, conf);
            hits.push({
              a: ai, b: bi,
              severity: rule.severity,
              effect: rule.effect,
              mechanism: rule.mechanism,
              recommendation: rule.recommendation,
              aIngredients: [...A],
              bIngredients: [...B],
              confidence: Number(conf.toFixed(2)),
              source: 'class-rule-kb',
              sourceClasses: [ca, cb],
              sourceClassLabels: [caLabel, cbLabel]
            });
          }
        }
      }
    }
  }

  hits.sort((x, y) => {
    const s = severityRank(y.severity) - severityRank(x.severity);
    if (s !== 0) return s;
    return y.confidence - x.confidence;
  });

  const seen = new Set<string>();
  const out: InteractionHit[] = [];
  for (const h of hits) {
    const key = h.a + '|' + h.b + '|' + h.source + '|' + h.effect;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

export function hasKBEntryFor(ingA: string, ingB: string): boolean {
  const { pairMap } = load();
  return pairMap.has(pkey(ingA.toLowerCase(), ingB.toLowerCase()));
}