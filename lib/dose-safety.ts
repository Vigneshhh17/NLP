import fs from 'node:fs';
import path from 'node:path';
import type { DrugMention, DoseSafetyAlert } from './types';

interface DoseLimit {
  class?: string;
  therapeutic_max_mg_per_day?: number;
  toxic_mg?: number;
  lethal_mg?: number;
  notes?: string;
  antidote?: string;
}

let cache: Record<string, DoseLimit> | null = null;

function loadLimits(): Record<string, DoseLimit> {
  if (cache) return cache;
  const p = path.join(process.cwd(), 'data', 'dose-limits.json');
  if (!fs.existsSync(p)) {
    cache = {};
    return cache;
  }
  cache = JSON.parse(fs.readFileSync(p, 'utf8'));
  return cache!;
}

/** Convert a dose to mg. Returns null if unit is not a mass unit. */
function toMg(value: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (u === 'mg') return value;
  if (u === 'mcg' || u === 'µg' || u === 'ug') return value / 1000;
  if (u === 'g') return value * 1000;
  if (u === 'kg') return value * 1_000_000;
  // Non-mass units — can't compare
  return null;
}

const RANK: Record<DoseSafetyAlert['level'], number> = {
  lethal: 3,
  toxic: 2,
  'above-therapeutic': 1
};

export function checkDose(mention: DrugMention): DoseSafetyAlert | null {
  if (!mention.dosage?.strengthValue || !mention.dosage?.strengthUnit) return null;

  const value = mention.dosage.strengthValue;
  const unit = mention.dosage.strengthUnit;
  const doseMg = toMg(value, unit);
  if (doseMg === null || doseMg <= 0) return null;

  const limits = loadLimits();

  // Try each ingredient in the mention; take the first that has a limit entry
  for (const ing of mention.genericIngredients) {
    const lim = limits[ing];
    if (!lim) continue;

    // Lethal → Toxic → Above-therapeutic
    if (lim.lethal_mg && doseMg >= lim.lethal_mg) {
      return makeAlert(mention, ing, doseMg, value, unit, 'lethal', lim.lethal_mg, 'reported lethal dose', lim);
    }
    if (lim.toxic_mg && doseMg >= lim.toxic_mg) {
      return makeAlert(mention, ing, doseMg, value, unit, 'toxic', lim.toxic_mg, 'toxic threshold', lim);
    }
    if (lim.therapeutic_max_mg_per_day && doseMg > lim.therapeutic_max_mg_per_day) {
      return makeAlert(mention, ing, doseMg, value, unit, 'above-therapeutic', lim.therapeutic_max_mg_per_day, 'max therapeutic daily dose', lim);
    }
    // Within normal range → no alert
    return null;
  }

  return null;
}

function makeAlert(
  mention: DrugMention,
  ingredient: string,
  doseMg: number,
  rawValue: number,
  rawUnit: string,
  level: DoseSafetyAlert['level'],
  thresholdMg: number,
  thresholdType: string,
  lim: DoseLimit
): DoseSafetyAlert {
  return {
    ingredient,
    mentionText: mention.text,
    doseMg,
    rawDose: `${rawValue} ${rawUnit}`,
    rawUnit,
    level,
    thresholdMg,
    thresholdType,
    drugClass: lim.class,
    notes: lim.notes,
    antidote: lim.antidote,
    confidence: mention.matchScore >= 0.85 ? 0.92 : 0.75
  };
}

export function checkAllDoses(mentions: DrugMention[]): DoseSafetyAlert[] {
  const alerts: DoseSafetyAlert[] = [];
  for (const m of mentions) {
    const a = checkDose(m);
    if (a) alerts.push(a);
  }
  return alerts.sort((a, b) => RANK[b.level] - RANK[a.level]);
}