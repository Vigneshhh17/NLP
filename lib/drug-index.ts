import fs from 'node:fs';
import path from 'node:path';
import type { DrugRecord } from './types';

export interface IndexBundle {
  records: string[][];
  inverted: Map<string, number[]>;
  ingredients: Record<string, number[]>;
}
let cachePromise: Promise<IndexBundle> | null = null;
function dataDir() { return path.join(process.cwd(), 'data', 'index'); }
function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s\-]/g, ' ').split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}
const STOP = new Set([
  'the','and','for','with','tablet','tablets','capsule','capsules','syrup',
  'injection','suspension','cream','gel','ointment','drops','solution','powder',
  'oral','mg','ml','mcg','iu'
]);
async function loadIndex(): Promise<IndexBundle> {
  const recPath = path.join(dataDir(), 'records.json');
  const ingPath = path.join(dataDir(), 'ingredients.json');
  if (!fs.existsSync(recPath)) {
    throw new Error('Drug index missing. Run npm run build:index.');
  }
  const records: string[][] = JSON.parse(fs.readFileSync(recPath, 'utf8'));
  const ingredients: Record<string, number[]> = fs.existsSync(ingPath)
    ? JSON.parse(fs.readFileSync(ingPath, 'utf8')) : {};
  const inverted = new Map<string, number[]>();
  for (let i = 0; i < records.length; i++) {
    const name = records[i][0];
    if (!name) continue;
    for (const tok of tokenize(name)) {
      const arr = inverted.get(tok);
      if (arr) arr.push(i); else inverted.set(tok, [i]);
    }
  }
  for (const ing of Object.keys(ingredients)) {
    for (const tok of tokenize(ing)) {
      if (!inverted.has(tok)) inverted.set(tok, []);
    }
  }
  return { records, inverted, ingredients };
}
export function getIndex(): Promise<IndexBundle> {
  if (!cachePromise) cachePromise = loadIndex();
  return cachePromise;
}
export function recordAt(idx: number, bundle: IndexBundle): DrugRecord {
  const r = bundle.records[idx] || ['', '', ''];
  return { idx, name: r[0], composition: r[1], type: r[2] };
}
export function candidatesFor(query: string, bundle: IndexBundle, limit = 25): number[] {
  const toks = tokenize(query);
  if (!toks.length) return [];
  const lists: number[][] = [];
  for (const t of toks) {
    const list = bundle.inverted.get(t);
    if (!list) return [];
    lists.push(list);
  }
  lists.sort((a, b) => a.length - b.length);
  const [smallest, ...rest] = lists;
  const out: number[] = [];
  outer: for (const id of smallest) {
    for (const l of rest) { if (!l.includes(id)) continue outer; }
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}
export function recordsForIngredient(ingredient: string, bundle: IndexBundle): number[] {
  const key = ingredient.toLowerCase().trim();
  if (bundle.ingredients[key]) return bundle.ingredients[key];
  for (const k of Object.keys(bundle.ingredients)) {
    if (k === key || k.startsWith(key + ' ')) return bundle.ingredients[k];
  }
  return [];
}
export function allIngredientKeys(bundle: IndexBundle): string[] {
  return Object.keys(bundle.ingredients);
}