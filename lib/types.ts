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
  /** When source is class-rule-kb, these are the class pair that fired */
  sourceClasses?: [string, string];
  /** Human labels for the classes */
  sourceClassLabels?: [string, string];
}

export interface AnalysisResult {
  text: string;
  mentions: DrugMention[];
  pairs: Array<{
    a: string; b: string;
    aStatus: ContextInfo['label']; bStatus: ContextInfo['label'];
    interactions: InteractionHit[];
    /** Fallback info shown when no interaction hit for this pair */
    aProfile?: DrugProfile;
    bProfile?: DrugProfile;
  }>;
  doseAlerts: DoseSafetyAlert[];
  warnings: string[];
  meta: { durationMs: number; recordCount: number };
}

export interface DrugProfile {
  ingredient: string;
  classes: Array<{ id: string; label: string }>;
}