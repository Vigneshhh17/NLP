import fs from 'node:fs';
import path from 'node:path';
let aliasCache: Record<string, string[]> | null = null;
export function loadAliases(): Record<string, string[]> {
  if (aliasCache) return aliasCache;
  const p = path.join(process.cwd(), 'data', 'aliases.json');
  if (!fs.existsSync(p)) return (aliasCache = {});
  try { aliasCache = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { aliasCache = {}; }
  return aliasCache!;
}
const FORM_WORDS = /\b(?:tablet|tab|cap|capsule|syrup|syp|injection|inj|suspension|susp|cream|gel|ointment|drop|drops|solution|sol|powder|sachet|spray|inhaler|respules?)\b/gi;
export function parseComposition(composition: string): string[] {
  if (!composition) return [];
  const parts = composition
    .split(/\s*(?:\+|,|;|\band\b|\bwith\b)\s*/i)
    .map((s) => s.replace(/\([^)]*\)/g, ' ').trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let p of parts) {
    p = p.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%|w\/v|w\/w)\b/gi, ' ');
    p = p.replace(FORM_WORDS, ' ');
    p = p.replace(/[^A-Za-z0-9\-\s]/g, ' ');
    p = p.replace(/\s+/g, ' ').trim().toLowerCase();
    if (p.length >= 3) out.push(p);
  }
  return [...new Set(out)];
}
export function aliasToIngredients(mention: string): string[] {
  const a = loadAliases();
  const key = mention.toLowerCase().trim();
  if (a[key]) return a[key];
  const first = key.split(/\s+/)[0];
  if (a[first]) return a[first];
  return [];
}