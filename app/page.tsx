'use client';
import { useState, useEffect, useRef } from 'react';
import type {
  AnalysisResult,
  DrugMention,
  InteractionHit,
  DoseSafetyAlert
} from '@/lib/types';

const SAMPLES = [
  { label: 'Warfarin + NSAID', text: 'Patient is currently on Coumadin 5mg OD and Advil 400mg TID.' },
  { label: 'Lethal dose', text: 'Patient ingested 200g of morphine.' },
  { label: 'SSRI + MAOI', text: 'StayHappi Fluoxetine 20mg Capsule plus Selgin Tablet.' },
  { label: 'Negation', text: 'He denies taking metformin. Currently on warfarin 5mg daily.' },
  { label: 'Historical', text: 'Discontinued aspirin two weeks ago. Started clopidogrel 75mg OD.' },
  { label: 'Multi-drug', text: 'On warfarin 5mg, aspirin 75mg, and ibuprofen 400mg TID.' }
];

export default function Home() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result && resultsRef.current) {
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [result]);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || 'Request failed');
      setResult(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <TopBar />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 sm:px-8">
        <Hero collapsed={!!result} />
        <CommandCenter
          text={text}
          setText={setText}
          loading={loading}
          onRun={run}
          onClear={() => { setText(''); setResult(null); setError(null); }}
        />
        {error && <ErrorCard message={error} />}
        <div ref={resultsRef} className="scroll-mt-6" />
        {result && <Results result={result} />}
        {!result && !error && <FeatureGrid />}
      </main>
      <Footer />
    </div>
  );
}

/* ============================================================
   TOP BAR
   ============================================================ */

function TopBar() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-violet-500 shadow-[0_4px_24px_-4px_rgba(34,211,238,0.55),inset_0_1px_0_0_rgba(255,255,255,0.4)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-black" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-white">DDI Intel</div>
            <div className="text-sm font-medium text-slate-400">Clinical NLP · v1.2</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <GlassPill>
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-cyan-400 pulse-dot" />
            253,973 indexed
          </GlassPill>
        </div>
      </div>
    </header>
  );
}

function GlassPill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={'inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-slate-200 backdrop-blur-md ' + className}>
      {children}
    </span>
  );
}

/* ============================================================
   HERO
   ============================================================ */

function Hero({ collapsed }: { collapsed: boolean }) {
  return (
    <section
      className={
        'relative isolate transition-all duration-500 ' +
        (collapsed ? 'pointer-events-none overflow-hidden opacity-0' : 'opacity-100 pb-16 pt-20 sm:pb-24 sm:pt-28')
      }
      style={{ maxHeight: collapsed ? 0 : 900, paddingTop: collapsed ? 0 : undefined, paddingBottom: collapsed ? 0 : undefined }}
    >
      <div className="hero-glow" aria-hidden />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur-md">
          <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-br from-cyan-400 to-violet-400" />
          Clinical NLP engine
          <span className="text-slate-600">·</span>
          <span className="text-slate-300">runs server-side</span>
        </div>
        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-7xl">
          <span className="metallic">Drug interaction </span>
          <span className="accent-gradient">intelligence.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
          Paste clinical text. Medications resolve against 253,973 Indian medicines,
          dosage and context are extracted, and interactions + dose safety are checked against curated KBs.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   COMMAND CENTER
   ============================================================ */

function CommandCenter({
  text, setText, loading, onRun, onClear
}: {
  text: string;
  setText: (v: string) => void;
  loading: boolean;
  onRun: () => void;
  onClear: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <section className="relative">
      <div className={'relative rounded-3xl border bg-[#14161D] transition-all duration-300 ' + (focused ? 'border-cyan-500/50 command-focus' : 'border-white/10 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-30px_rgba(0,0,0,0.9)]')}>
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-2">
              <span className="h-3 w-3 rounded-full bg-white/10" />
              <span className="h-3 w-3 rounded-full bg-white/10" />
              <span className="h-3 w-3 rounded-full bg-white/10" />
            </div>
            <span className="ml-3 text-sm font-medium text-slate-300">clinical_input.txt</span>
          </div>
          <span className="font-mono text-sm text-slate-400">{text.length} chars</span>
        </div>
        <div className="relative bg-[#1A1D26] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim() && !loading) onRun();
            }}
            placeholder="Paste clinical notes, a prescription, or any text mentioning medications…"
            spellCheck={false}
            className="min-h-[220px] w-full resize-y bg-transparent px-7 py-6 text-xl font-normal leading-[1.65] text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-t border-white/10 px-6 py-4">
          <span className="mr-1 text-sm font-semibold text-slate-300">Try</span>
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              onClick={() => setText(s.text)}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition-all duration-200 hover:-translate-y-px hover:border-cyan-400/50 hover:bg-cyan-500/20 hover:text-white"
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 bg-black/30 px-6 py-4">
          <button
            onClick={onRun}
            disabled={loading || !text.trim()}
            className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl px-6 py-3 text-base font-semibold text-black transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: 'linear-gradient(180deg, #67E8F9 0%, #22D3EE 100%)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.5) inset, 0 8px 26px -8px rgba(34,211,238,0.75)'
            }}
          >
            {loading ? (
              <>Analyzing…</>
            ) : (
              <>
                Analyze
                <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
          <button
            onClick={onClear}
            disabled={loading || !text}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-base font-medium text-slate-200 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   RESULTS
   ============================================================ */

function Results({ result }: { result: AnalysisResult }) {
  const allHits = result.pairs.flatMap((p) => p.interactions);
  const doseAlerts = result.doseAlerts || [];

  if (result.mentions.length === 0 && doseAlerts.length === 0) {
    return (
      <div className="mt-12 rise">
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Icon.Search className="h-7 w-7 text-slate-300" />
          </div>
          <div className="text-2xl font-semibold text-white">No matches found</div>
          <div className="mx-auto mt-3 max-w-lg text-lg leading-relaxed text-slate-300">
            Nothing in this text was recognised as a medication. Try a clinical input like
            <span className="mx-1.5 rounded bg-white/10 px-2 py-0.5 font-mono text-base text-white">warfarin 5mg and ibuprofen 400mg</span>.
          </div>
        </div>
      </div>
    );
  }

  const severityOrder = ['contraindicated', 'major', 'moderate', 'minor'] as const;
  const ddiTop = severityOrder.find((s) => allHits.some((h) => h.severity === s));
  const doseTopLevel = doseAlerts[0]?.level;
  const topSeverityLabel =
    doseTopLevel === 'lethal' ? 'Lethal dose'
      : doseTopLevel === 'toxic' ? 'Toxic dose'
      : ddiTop ? capitalize(ddiTop)
      : doseTopLevel === 'above-therapeutic' ? 'Above therapeutic'
      : '—';
  const isAlarming = doseTopLevel === 'lethal' || doseTopLevel === 'toxic' || ddiTop === 'contraindicated' || ddiTop === 'major';

  const counts = result.mentions.reduce(
    (acc, m) => { acc[m.context.label]++; return acc; },
    { current: 0, negated: 0, historical: 0, hypothetical: 0 } as Record<string, number>
  );

  return (
    <div className="mt-12 space-y-16 rise">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Medications" value={String(result.mentions.length)} sub={counts.current + ' active'} accent="cyan" />
        <StatCard label="Interactions" value={String(allHits.length)} sub={result.pairs.length + ' pairs checked'} accent={allHits.length ? 'rose' : 'zinc'} />
        <StatCard label="Dose alerts" value={String(doseAlerts.length)} sub={doseAlerts.length ? 'review required' : 'none'} accent={doseAlerts.length ? 'rose' : 'zinc'} />
        <StatCard
          label="Top severity"
          value={topSeverityLabel}
          sub={isAlarming ? 'requires attention' : result.meta.durationMs + ' ms · ' + result.meta.recordCount.toLocaleString() + ' records'}
          accent={isAlarming ? 'rose' : 'violet'}
        />
      </section>

      {doseAlerts.length > 0 && (
        <section>
          <SectionTitle title="Dose safety" count={doseAlerts.length} />
          <div className="space-y-4">
            {doseAlerts.map((a, i) => <DoseAlertCard key={i} alert={a} />)}
          </div>
        </section>
      )}

      {result.warnings.length > 0 && (
        <section>
          <SectionTitle title="Context notes" count={result.warnings.length} />
          <div className="space-y-3">
            {result.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.1] px-6 py-5 text-lg leading-relaxed text-amber-100">
                <Icon.Alert className="mt-1 h-6 w-6 flex-shrink-0 text-amber-300" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Detected medications" count={result.mentions.length} />
        <div className="grid gap-5 md:grid-cols-2">
          {result.mentions.map((m, i) => <MentionCard key={i} m={m} />)}
        </div>
      </section>

      {result.pairs.length > 0 && (
        <section>
          <SectionTitle title="Drug pairs & interactions" count={allHits.length} />
          <div className="space-y-7">
            {result.pairs.map((p, i) => <PairBlock key={i} pair={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================================
   DOSE ALERT
   ============================================================ */

function DoseAlertCard({ alert }: { alert: DoseSafetyAlert }) {
  const styles: Record<string, { bg: string; border: string; text: string; badge: string; dot: string; label: string; bar: string }> = {
    lethal: { bg: 'bg-red-500/[0.08]', border: 'border-red-500/40', text: 'text-red-100', badge: 'bg-red-500/25 text-red-100', dot: 'bg-red-300', label: 'LETHAL DOSE', bar: 'bg-gradient-to-b from-red-400 to-red-600' },
    toxic: { bg: 'bg-rose-500/[0.08]', border: 'border-rose-500/40', text: 'text-rose-100', badge: 'bg-rose-500/25 text-rose-100', dot: 'bg-rose-300', label: 'TOXIC DOSE', bar: 'bg-gradient-to-b from-rose-400 to-rose-600' },
    'above-therapeutic': { bg: 'bg-amber-500/[0.06]', border: 'border-amber-500/40', text: 'text-amber-100', badge: 'bg-amber-500/25 text-amber-100', dot: 'bg-amber-300', label: 'ABOVE THERAPEUTIC', bar: 'bg-gradient-to-b from-amber-400 to-amber-600' }
  };
  const s = styles[alert.level];
  const doseDisplay = alert.doseMg >= 1000
    ? `${(alert.doseMg / 1000).toLocaleString()} g`
    : `${alert.doseMg.toLocaleString()} mg`;

  return (
    <div className={'relative overflow-hidden rounded-2xl border ' + s.border + ' ' + s.bg}>
      <div className={'absolute left-0 top-0 h-full w-1.5 ' + s.bar} />
      <div className="py-7 pl-8 pr-7">
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <span className={'inline-flex items-center gap-2.5 rounded-xl px-4 py-2 text-lg font-bold ' + s.badge}>
            <span className={'h-2.5 w-2.5 rounded-full ' + s.dot} />
            {s.label}
          </span>
          <span className="font-mono text-xl font-semibold text-white">{alert.mentionText}</span>
          {alert.drugClass && <span className="text-base text-slate-300">· {alert.drugClass}</span>}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-base font-semibold text-slate-300">Confidence</span>
            <span className="inline-block h-3 w-20 overflow-hidden rounded-full bg-white/10 align-middle">
              <span className="bar-glow block h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: (alert.confidence * 100).toFixed(0) + '%' }} />
            </span>
            <span className="font-mono text-lg font-semibold text-white">{(alert.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="space-y-4 text-lg">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr] sm:gap-6">
            <div className="font-semibold text-slate-300">Dose given</div>
            <div className={s.text}>
              <span className="font-mono font-semibold">{alert.rawDose}</span>
              {alert.rawUnit.toLowerCase() !== 'mg' && <span className="text-slate-300"> ({doseDisplay})</span>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr] sm:gap-6">
            <div className="font-semibold text-slate-300">Threshold</div>
            <div className={s.text}>
              <span className="font-mono font-semibold">{alert.thresholdMg.toLocaleString()} mg</span>
              <span className="text-slate-300"> — {alert.thresholdType}</span>
            </div>
          </div>
          {alert.notes && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr] sm:gap-6">
              <div className="font-semibold text-slate-300">Notes</div>
              <div className="text-slate-200">{alert.notes}</div>
            </div>
          )}
          {alert.antidote && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr] sm:gap-6">
              <div className="font-semibold text-slate-300">Antidote</div>
              <div className="font-semibold text-emerald-200">{alert.antidote}</div>
            </div>
          )}
        </div>
        <div className="mt-5 text-base text-slate-400">Source · dose-limits.json (curated clinical thresholds)</div>
      </div>
    </div>
  );
}

/* ============================================================
   SHARED
   ============================================================ */

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-7 flex items-baseline gap-4">
      <h2 className="text-3xl font-semibold tracking-tight text-white">{title}</h2>
      {count !== undefined && (
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1 font-mono text-base font-medium text-slate-200">{count}</span>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: 'cyan' | 'rose' | 'violet' | 'zinc'; }) {
  const accents: Record<string, string> = { cyan: 'text-cyan-300', rose: 'text-rose-300', violet: 'text-violet-300', zinc: 'text-white' };
  const rings: Record<string, string> = {
    cyan: 'shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_12px_32px_-16px_rgba(34,211,238,0.45)]',
    rose: 'shadow-[0_0_0_1px_rgba(244,63,94,0.22),0_12px_32px_-16px_rgba(244,63,94,0.45)]',
    violet: 'shadow-[0_0_0_1px_rgba(167,139,250,0.2)]',
    zinc: 'shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
  };
  return (
    <div className={'relative overflow-hidden rounded-2xl border border-white/10 bg-[#14161D] p-6 ' + rings[accent]}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />
      <div className="text-base font-semibold text-slate-300">{label}</div>
      <div className={`mt-3 text-4xl font-semibold leading-none tracking-[-0.03em] ${accents[accent]}`}>{value}</div>
      <div className="mt-3 text-base text-slate-300">{sub}</div>
    </div>
  );
}

function MentionCard({ m }: { m: DrugMention }) {
  const statusStyles: Record<string, string> = {
    current: 'border-cyan-500/40 bg-cyan-500/20 text-cyan-100',
    negated: 'border-slate-400/40 bg-slate-400/20 text-slate-50',
    historical: 'border-violet-500/40 bg-violet-500/20 text-violet-100',
    hypothetical: 'border-amber-500/40 bg-amber-500/20 text-amber-100'
  };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#14161D] p-7 transition-all duration-300 hover:border-white/20 hover:bg-[#1A1D26]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)' }} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-2xl font-semibold tracking-tight text-white">{m.text}</div>
          {m.matchedRecord ? (
            <div className="mt-2 truncate text-lg text-slate-300">
              {m.matchedRecord.name}{m.matchedRecord.type ? ' · ' + m.matchedRecord.type : ''}
            </div>
          ) : (
            <div className="mt-2 text-lg text-slate-400">no dataset record</div>
          )}
        </div>
        <span className={'shrink-0 rounded-lg border px-4 py-2 text-base font-bold ' + statusStyles[m.context.label]}>{m.context.label}</span>
      </div>
      {m.genericIngredients.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2.5">
          {m.genericIngredients.map((g) => (
            <span key={g} className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3.5 py-1.5 font-mono text-base font-semibold text-cyan-100">{g}</span>
          ))}
        </div>
      )}
      {m.dosage && (m.dosage.strength || m.dosage.form || m.dosage.frequency || m.dosage.route) && (
        <div className="mt-6 flex flex-wrap gap-x-7 gap-y-2.5 text-lg">
          {m.dosage.strength && <DosageField label="Strength" value={m.dosage.strength} />}
          {m.dosage.frequency && <DosageField label="Freq" value={m.dosage.frequency} />}
          {m.dosage.form && <DosageField label="Form" value={m.dosage.form} />}
          {m.dosage.route && <DosageField label="Route" value={m.dosage.route} />}
        </div>
      )}
      <div className="mt-7 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between text-base">
          <span className="text-slate-300"><span className="font-semibold text-slate-100">{m.matchKind}</span> match</span>
          <span className="font-mono text-xl font-semibold text-white">{(m.matchScore * 100).toFixed(0)}%</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="bar-glow h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-300" style={{ width: (m.matchScore * 100).toFixed(0) + '%' }} />
        </div>
      </div>
    </div>
  );
}

function DosageField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-base font-semibold text-slate-400">{label}</span>
      <span className="font-mono font-medium text-white">{value}</span>
    </div>
  );
}

/* ============================================================
   PAIR BLOCK + NO-INTERACTION PANEL
   ============================================================ */

function PairBlock({ pair }: { pair: AnalysisResult['pairs'][number] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#14161D]">
      <div className="flex flex-wrap items-center gap-5 border-b border-white/10 bg-white/[0.02] px-7 py-6">
        <div className="flex items-center gap-3.5 font-mono text-2xl">
          <span className="font-semibold text-white">{pair.a}</span>
          <span className="text-slate-500">+</span>
          <span className="font-semibold text-white">{pair.b}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatusPill status={pair.aStatus} />
          <StatusPill status={pair.bStatus} />
        </div>
      </div>
      <div className="divide-y divide-white/10">
        {pair.interactions.length === 0 ? (
          <NoInteractionPanel aName={pair.a} bName={pair.b} aProfile={pair.aProfile} bProfile={pair.bProfile} />
        ) : (
          pair.interactions.map((h, i) => <InteractionBlock key={i} hit={h} />)
        )}
      </div>
    </div>
  );
}

function NoInteractionPanel({
  aName, bName, aProfile, bProfile
}: {
  aName: string;
  bName: string;
  aProfile?: AnalysisResult['pairs'][number]['aProfile'];
  bProfile?: AnalysisResult['pairs'][number]['bProfile'];
}) {
  return (
    <div className="px-7 py-8">
      <div className="mb-6 flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
        <svg viewBox="0 0 24 24" className="mt-1 h-5 w-5 flex-shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          <div className="text-lg font-semibold text-white">No documented interaction in the knowledge base</div>
          <div className="mt-1 text-base text-slate-300">
            Neither an ingredient-level pair nor a class-level rule matched <span className="font-mono text-white">{aName}</span> and <span className="font-mono text-white">{bName}</span>.
            This does <span className="font-semibold text-white">not</span> guarantee safety — always check a full interaction database before co-prescribing.
          </div>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <DrugProfileCard title={aName} profile={aProfile} />
        <DrugProfileCard title={bName} profile={bProfile} />
      </div>
    </div>
  );
}

function DrugProfileCard({
  title, profile
}: {
  title: string;
  profile?: AnalysisResult['pairs'][number]['aProfile'];
}) {
  const hasClasses = profile && profile.classes.length > 0;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0F1117] p-5">
      <div className="mb-3 truncate font-mono text-base font-semibold text-white">{title}</div>
      {hasClasses ? (
        <>
          <div className="mb-2 text-sm font-semibold text-slate-400">Drug class</div>
          <div className="flex flex-wrap gap-2">
            {profile!.classes.map((c) => (
              <span key={c.id} className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-3 py-1.5 text-sm font-medium text-violet-100">
                {c.label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="text-base text-slate-400">No class information available in the local KB for this ingredient.</div>
      )}
    </div>
  );
}

/* ============================================================
   INTERACTION BLOCK
   ============================================================ */

function InteractionBlock({ hit }: { hit: InteractionHit }) {
  const sevStyles: Record<string, { bg: string; text: string; bar: string; dot: string }> = {
    contraindicated: { bg: 'bg-rose-500/20', text: 'text-rose-100', bar: 'bg-gradient-to-b from-rose-400 to-rose-600', dot: 'bg-rose-300' },
    major: { bg: 'bg-red-500/20', text: 'text-red-100', bar: 'bg-gradient-to-b from-red-400 to-red-600', dot: 'bg-red-300' },
    moderate: { bg: 'bg-amber-500/20', text: 'text-amber-100', bar: 'bg-gradient-to-b from-amber-400 to-amber-600', dot: 'bg-amber-300' },
    minor: { bg: 'bg-yellow-500/20', text: 'text-yellow-100', bar: 'bg-gradient-to-b from-yellow-400 to-yellow-600', dot: 'bg-yellow-200' },
    unknown: { bg: 'bg-slate-500/20', text: 'text-slate-100', bar: 'bg-slate-500', dot: 'bg-slate-300' }
  };
  const s = sevStyles[hit.severity] || sevStyles.unknown;
  const isClassRule = hit.source === 'class-rule-kb';

  return (
    <div className="relative">
      <div className={'absolute left-0 top-0 h-full w-1.5 ' + s.bar} />
      <div className="py-8 pl-8 pr-7">
        <div className="mb-7 flex flex-wrap items-center gap-4">
          <span className={'inline-flex items-center gap-2.5 rounded-xl px-4 py-2 text-lg font-bold ' + s.bg + ' ' + s.text}>
            <span className={'h-2.5 w-2.5 rounded-full ' + s.dot} />
            {hit.severity}
          </span>
          {hit.sourceClassLabels ? (
            <>
              <span className="font-mono text-lg font-medium text-slate-100">{hit.sourceClassLabels[0]}</span>
              <span className="text-lg text-slate-500">+</span>
              <span className="font-mono text-lg font-medium text-slate-100">{hit.sourceClassLabels[1]}</span>
            </>
          ) : (
            <>
              <span className="font-mono text-xl font-medium text-slate-100">{hit.a}</span>
              <span className="text-xl text-slate-500">+</span>
              <span className="font-mono text-xl font-medium text-slate-100">{hit.b}</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-3.5">
            <span className="text-base font-semibold text-slate-300">Confidence</span>
            <span className="inline-block h-3 w-24 overflow-hidden rounded-full bg-white/10 align-middle">
              <span className="bar-glow block h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: (hit.confidence * 100).toFixed(0) + '%' }} />
            </span>
            <span className="font-mono text-xl font-semibold text-white">{(hit.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        {isClassRule && (
          <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-100">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
            Class-level rule — inferred because neither ingredient was directly paired in the KB
          </div>
        )}
        <div className="space-y-5">
          <Field label="Effect" body={hit.effect} tone="text-white" />
          <Field label="Mechanism" body={hit.mechanism} tone="text-slate-200" />
          <Field label="Recommendation" body={hit.recommendation} tone="text-emerald-200" />
        </div>
        <div className="mt-6 text-base font-medium text-slate-400">
          Source · {hit.source}{hit.sourceClasses ? ` (${hit.sourceClasses.join(' × ')})` : ''}
        </div>
      </div>
    </div>
  );
}

function Field({ label, body, tone }: { label: string; body: string; tone: string }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr] sm:gap-6">
      <div className="text-lg font-semibold text-slate-300">{label}</div>
      <div className={`text-lg leading-[1.7] ${tone}`}>{body}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    current: 'border-cyan-500/40 bg-cyan-500/20 text-cyan-100',
    negated: 'border-slate-400/40 bg-slate-400/20 text-slate-50',
    historical: 'border-violet-500/40 bg-violet-500/20 text-violet-100',
    hypothetical: 'border-amber-500/40 bg-amber-500/20 text-amber-100'
  };
  return <span className={'rounded-lg border px-4 py-2 text-base font-bold ' + (map[status] || map.current)}>{status}</span>;
}

/* ============================================================
   ERROR + FEATURE GRID + FOOTER
   ============================================================ */

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="mt-8 flex items-start gap-4 rounded-2xl border border-red-500/30 bg-red-500/[0.08] px-6 py-5">
      <Icon.Alert className="mt-1 h-6 w-6 flex-shrink-0 text-red-300" />
      <div>
        <div className="text-lg font-semibold text-red-100">Analysis failed</div>
        <div className="mt-1 text-lg text-red-200">{message}</div>
      </div>
    </div>
  );
}

function FeatureGrid() {
  const features = [
    { icon: <Icon.Layers />, title: 'Multi-drug aware', body: 'Detects any number of medications in a single text and evaluates every pair.' },
    { icon: <Icon.EyeOff />, title: 'Context-aware', body: 'Distinguishes current, negated, historical, and hypothetical mentions.' },
    { icon: <Icon.Book />, title: 'Dose-safe', body: 'Compares extracted doses against clinical thresholds for lethal, toxic, and above-therapeutic ranges.' }
  ];
  return (
    <section className="mt-20">
      <div className="grid gap-5 sm:grid-cols-3">
        {features.map((f, i) => (
          <div key={i} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#14161D] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-[#1A1D26]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-300 transition-colors group-hover:border-cyan-400/40 group-hover:bg-cyan-500/15 group-hover:text-cyan-200">{f.icon}</div>
            <div className="text-xl font-semibold tracking-tight text-white">{f.title}</div>
            <div className="mt-3 text-lg leading-[1.7] text-slate-300">{f.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 mx-auto mt-28 w-full max-w-6xl px-6 pb-14 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-7 text-base text-slate-400">
        <div>
          Dataset · <span className="text-slate-200">Indian Medicine Dataset (253,973 records)</span>
          <span className="mx-3 text-slate-600">·</span>
          DDI KB + Dose-safety KB · <span className="text-slate-200">curated</span>
        </div>
        <div className="font-mono text-base text-slate-400">v1.2</div>
      </div>
    </footer>
  );
}

/* ============================================================
   ICONS + UTILS
   ============================================================ */

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

const Icon = {
  Alert: ({ className = '' }: { className?: string }) => (
    <svg {...iconProps} className={className}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
  ),
  Search: ({ className = '' }: { className?: string }) => (
    <svg {...iconProps} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  ),
  Layers: () => (
    <svg {...iconProps} className="h-7 w-7"><path d="m12 2 9 5-9 5-9-5 9-5z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>
  ),
  EyeOff: () => (
    <svg {...iconProps} className="h-7 w-7"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></svg>
  ),
  Book: () => (
    <svg {...iconProps} className="h-7 w-7"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
  )
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}