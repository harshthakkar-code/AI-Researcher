import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;

  // 1. Try FastAPI backend first
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const res = await fetch(`${aiServiceUrl}/research/${id}/revert/${versionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('FastAPI revert failed, falling back to direct Supabase revert:', err);
  }

  // 2. Direct Supabase Fallback (ensures revert always succeeds even if FastAPI is offline)
  try {
    const supabase = createAdminClient();

    // Fetch target version
    const { data: targetVersion, error: vErr } = await supabase
      .from('report_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (vErr || !targetVersion) {
      return NextResponse.json({ error: 'Target version not found' }, { status: 404 });
    }

    // Fetch active report
    const { data: report, error: rErr } = await supabase
      .from('reports')
      .select('*')
      .eq('research_id', id)
      .limit(1)
      .single();

    if (rErr || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Get max version number
    const { data: maxV } = await supabase
      .from('report_versions')
      .select('version_number')
      .eq('report_id', report.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVer = (maxV?.[0]?.version_number || 1) + 1;
    const summary = `Reverted back to Version #${targetVersion.version_number || 'previous'}`;

    // Insert new reverted version
    const { data: newV, error: insErr } = await supabase
      .from('report_versions')
      .insert({
        report_id: report.id,
        version_number: nextVer,
        content_markdown: targetVersion.content_markdown,
        word_count: targetVersion.word_count || targetVersion.content_markdown.split(/\s+/).length,
        change_summary: summary,
      })
      .select()
      .single();

    if (insErr || !newV) {
      return NextResponse.json({ error: 'Failed to record reverted version' }, { status: 500 });
    }

    // Update active report document
    await supabase
      .from('reports')
      .update({
        content_markdown: targetVersion.content_markdown,
        word_count: newV.word_count,
        active_version_id: newV.id,
      })
      .eq('id', report.id);

    return NextResponse.json({
      status: 'reverted',
      new_version: newV,
    });
  } catch (error: any) {
    console.error('Fatal revert error:', error);
    return NextResponse.json({ error: error.message || 'Failed to revert version' }, { status: 500 });
  }
}
