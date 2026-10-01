import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch research job
    const { data: job, error: jobErr } = await supabase
      .from('research_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Research job not found' }, { status: 404 });
    }

    // Fetch related sources, facts, logs, report in parallel
    const [queriesRes, sourcesRes, factsRes, logsRes, reportRes] = await Promise.all([
      supabase.from('research_queries').select('*').eq('research_id', id).order('search_order'),
      supabase.from('sources').select('*').eq('research_id', id).order('created_at'),
      supabase.from('facts').select('*').eq('research_id', id).order('created_at'),
      supabase.from('agent_logs').select('*').eq('research_id', id).order('created_at', { ascending: true }),
      supabase.from('reports').select('*').eq('research_id', id).order('created_at', { ascending: false }).limit(1),
    ]);

    return NextResponse.json({
      job,
      queries: queriesRes.data || [],
      sources: sourcesRes.data || [],
      facts: factsRes.data || [],
      logs: logsRes.data || [],
      report: reportRes.data?.[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Use admin client with service role key to permanently delete regardless of RLS
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
      .from('research_jobs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete research job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Research job and all artifacts permanently deleted' });
  } catch (error: any) {
    console.error('Error during deletion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
