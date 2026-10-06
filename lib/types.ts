export interface DrugRecord {
  idx: number;
  name: string;
  composition: string;
  type: string;
}

export interface DrugMention {
  text: string;
  start: number;
  end: number;
  matchKind: 'dataset-name' | 'dataset-ingredient' | 'alias' | 'unknown';
  matchScore: number;
  matchedRecord?: DrugRecord;
  genericIngredients: string[];
  dosage?: DosageInfo;
  context: ContextInfo;
  candidates?: DrugRecord[];
}

export interface DosageInfo {
  strength?: string;
  strengthValue?: number;
  strengthUnit?: string;
  form?: string;
  frequency?: string;
  route?: string;
}

export interface ContextInfo {
  negated: boolean;
  historical: boolean;
  hypothetical: boolean;
  label: 'current' | 'negated' | 'historical' | 'hypothetical';
}

export interface InteractionHit {
  a: string;
  b: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor' | 'unknown';
  effect: string;
  mechanism: string;
  recommendation: string;
  aIngredients: string[];
  bIngredients: string[];
  confidence: number;
  source: 'ingredient-pair-kb' | 'class-rule-kb';
  sourceClasses?: [string, string];
  sourceClassLabels?: [string, string];
}

export interface DoseSafetyAlert {
  ingredient: string;
  mentionText: string;
  doseMg: number;
  rawDose: string;
  rawUnit: string;
  level: 'lethal' | 'toxic' | 'above-therapeutic';
  thresholdMg: number;
  thresholdType: string;
  drugClass?: string;
  notes?: string;
  antidote?: string;
  confidence: number;
}

export interface DrugProfile {
  ingredient: string;
  classes: Array<{ id: string; label: string }>;
}

export interface AnalysisResult {
  text: string;
  mentions: DrugMention[];
  pairs: Array<{
    a: string;
    b: string;
    aStatus: ContextInfo['label'];
    bStatus: ContextInfo['label'];
    interactions: InteractionHit[];
    aProfile?: DrugProfile;
    bProfile?: DrugProfile;
  }>;
  doseAlerts: DoseSafetyAlert[];
  warnings: string[];
  meta: { durationMs: number; recordCount: number };
}