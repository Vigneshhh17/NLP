import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data', 'raw');
const OUT_DIR = path.join(ROOT, 'data', 'index');
const OUT_RECORDS = path.join(OUT_DIR, 'records.json');
const OUT_INGREDIENTS = path.join(OUT_DIR, 'ingredients.json');

const ifMissing = process.argv.includes('--if-missing');
if (ifMissing && fs.existsSync(OUT_RECORDS) && fs.existsSync(OUT_INGREDIENTS)) {
  console.log('[build-index] index already present, skipping');
  process.exit(0);
}

const CANDIDATE_URLS = [
  'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/data/medicine.csv',
  'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/medicine.csv',
  'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/indian_medicine_data.csv',
  'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/data/indian_medicine_data.csv',
  'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/medicines.csv',
  'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/master/data/medicine.csv'
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' for ' + url)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCsvLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvToRows(text) {
  const rows = []; let buf = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      buf += ch;
      if (inQ && text[i + 1] === '"') { buf += text[i + 1]; i++; continue; }
      inQ = !inQ;
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (buf.length) { rows.push(buf); buf = ''; }
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else buf += ch;
  }
  if (buf.length) rows.push(buf);
  if (!rows.length) return { header: [], rows: [] };
  const header = parseCsvLine(rows[0]).map((h) => h.toLowerCase());
  const body = rows.slice(1).map(parseCsvLine);
  return { header, rows: body };
}

function pickCol(header, candidates) {
  for (const c of candidates) { const idx = header.indexOf(c); if (idx >= 0) return idx; }
  for (let i = 0; i < header.length; i++) for (const c of candidates) if (header[i].includes(c)) return i;
  return -1;
}

function normalizeComposition(raw) {
  if (!raw) return '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

function extractIngredients(composition) {
  if (!composition) return [];
  const parts = composition.split(/\s*(?:\+|,|;|\band\b)\s*/i)
    .map((s) => s.replace(/\([^)]*\)/g, ' ').trim()).filter(Boolean);
  const out = [];
  for (let p of parts) {
    p = p.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|%|w\/v|w\/w)?\b/gi, ' ');
    p = p.replace(/\b(?:tablet|capsule|syrup|injection|suspension|cream|gel|ointment|drop|drops|solution|powder)\b/gi, ' ');
    p = p.replace(/[^A-Za-z0-9\-\s]/g, ' ');
    p = p.replace(/\s+/g, ' ').trim().toLowerCase();
    if (p && p.length >= 3) out.push(p);
  }
  return [...new Set(out)];
}

async function loadDataset() {
  if (fs.existsSync(RAW_DIR)) {
    const files = fs.readdirSync(RAW_DIR);
    for (const f of files) {
      const full = path.join(RAW_DIR, f);
      if (f.endsWith('.json')) { console.log('[build-index] using local JSON:', f); return JSON.parse(fs.readFileSync(full, 'utf8')); }
      if (f.endsWith('.csv')) { console.log('[build-index] using local CSV:', f); return csvToRows(fs.readFileSync(full, 'utf8')); }
    }
  }
  let lastErr;
  for (const url of CANDIDATE_URLS) {
    try { console.log('[build-index] fetching', url); const txt = await fetchText(url); return csvToRows(txt); }
    catch (e) { lastErr = e; console.warn('[build-index] failed:', e.message); }
  }
  throw new Error('Could not load Indian Medicine Dataset: ' + (lastErr ? lastErr.message : 'unknown'));
}

function normalizeRows(data) {
  if (Array.isArray(data)) {
    const out = [];
    for (const r of data) {
      const name = r.name ?? r.Name ?? r.medicine_name ?? r.medicineName ?? '';
      const composition = r.composition ?? r.Composition ?? r.composition1 ?? '';
      const type = r.type ?? r.Type ?? r.medicine_type ?? '';
      if (name) out.push([String(name).trim(), normalizeComposition(composition), String(type || '').trim()]);
    }
    return out;
  }
  const { header, rows } = data;
  const iName = pickCol(header, ['name', 'medicine_name', 'medicinename', 'product_name', 'brand']);
  const iComp = pickCol(header, ['composition', 'ingredients', 'active_ingredient', 'salt', 'salt_composition']);
  const iType = pickCol(header, ['type', 'medicine_type', 'form', 'dosage_form']);
  if (iName < 0) throw new Error('No name column found. Header: ' + header.join(','));
  const out = [];
  for (const r of rows) {
    const name = (r[iName] || '').trim();
    if (!name) continue;
    const composition = iComp >= 0 ? normalizeComposition(r[iComp] || '') : '';
    const type = iType >= 0 ? (r[iType] || '').trim() : '';
    out.push([name, composition, type]);
  }
  return out;
}

async function main() {
  const data = await loadDataset();
  const records = normalizeRows(data);
  console.log('[build-index] records:', records.length);
  const ingredients = {};
  for (let i = 0; i < records.length; i++) {
    const comp = records[i][1];
    if (!comp) continue;
    for (const ing of extractIngredients(comp)) { (ingredients[ing] ||= []).push(i); }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_RECORDS, JSON.stringify(records));
  fs.writeFileSync(OUT_INGREDIENTS, JSON.stringify(ingredients));
  const sizeMb = (fs.statSync(OUT_RECORDS).size / (1024 * 1024)).toFixed(1);
  const ingMb = (fs.statSync(OUT_INGREDIENTS).size / (1024 * 1024)).toFixed(1);
  console.log('[build-index] wrote ' + OUT_RECORDS + ' (' + sizeMb + ' MB)');
  console.log('[build-index] wrote ' + OUT_INGREDIENTS + ' (' + ingMb + ' MB, ' + Object.keys(ingredients).length + ' ingredients)');
}

main().catch((e) => { console.error('[build-index] fatal:', e); process.exit(1); });