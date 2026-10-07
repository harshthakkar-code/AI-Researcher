import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const supabase = await createClient();

    // If is_pinned is explicitly provided, use it; otherwise toggle current value
    let newPinState: boolean;
    if (typeof body.is_pinned === 'boolean') {
      newPinState = body.is_pinned;
    } else {
      const { data: currentJob, error: fetchErr } = await supabase
        .from('research_jobs')
        .select('is_pinned')
        .eq('id', id)
        .single();

      if (fetchErr || !currentJob) {
        return NextResponse.json({ error: 'Research session not found' }, { status: 404 });
      }
      newPinState = !currentJob.is_pinned;
    }

    const { data: updatedJob, error: updateErr } = await supabase
      .from('research_jobs')
      .update({ is_pinned: newPinState })
      .eq('id', id)
      .select('id, is_pinned')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_pinned: updatedJob.is_pinned });
  } catch (error: any) {
    console.error('Error toggling pin status:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
