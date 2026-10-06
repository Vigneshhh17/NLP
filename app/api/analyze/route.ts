import { NextResponse } from 'next/server';
import { analyze } from '@/lib/pipeline';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === 'string' ? body.text : '';
    const result = await analyze(text);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: 'Analysis failed', detail: e?.message || String(e) }, { status: 500 });
  }
}