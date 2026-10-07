import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    // 1. Try FastAPI endpoint
    try {
      const res = await fetch(`${aiServiceUrl}/research/${id}/versions`);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (e) {
      console.warn('FastAPI versions endpoint failed, trying Supabase fallback:', e);
    }

    // 2. Fallback to Supabase direct query
    const supabase = await createClient();
    const { data: report } = await supabase
      .from('reports')
      .select('id, active_version_id')
      .eq('research_id', id)
      .limit(1)
      .single();

    if (!report) {
      return NextResponse.json({ versions: [], active_version_id: null });
    }

    const { data: versions } = await supabase
      .from('report_versions')
      .select('*')
      .eq('report_id', report.id)
      .order('version_number', { ascending: false });

    return NextResponse.json({
      report_id: report.id,
      active_version_id: report.active_version_id,
      versions: versions || [],
    });
  } catch (error: any) {
    console.error('Error fetching report versions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
