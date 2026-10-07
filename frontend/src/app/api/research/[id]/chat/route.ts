import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'A question or prompt message is required' },
        { status: 400 }
      );
    }

    // Immediately mark status as 'researching' in Supabase so sidebar spinner displays right away
    try {
      const supabase = await createClient();
      await supabase
        .from('research_jobs')
        .update({ status: 'researching', progress: 50 })
        .eq('id', id);
    } catch (dbErr) {
      console.warn('Initial job status update notice:', dbErr);
    }

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const res = await fetch(`${aiServiceUrl}/research/${id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        research_id: id,
        message: message.trim(),
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData.detail || 'Failed to generate research response' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error proxying chat to AI service:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
