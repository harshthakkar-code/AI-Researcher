import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'A research topic is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Create research_job record in Supabase
    const { data: job, error: insertError } = await supabase
      .from('research_jobs')
      .insert({
        topic: topic.trim(),
        user_id: user?.id || null,
        status: 'pending',
        progress: 0,
      })
      .select()
      .single();

    if (insertError || !job) {
      console.error('Failed to create research job in Supabase:', insertError);
      return NextResponse.json(
        { error: 'Failed to create research job', details: insertError?.message },
        { status: 500 }
      );
    }

    // 2. Dispatch to Python AI Service
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    try {
      const aiResponse = await fetch(`${aiServiceUrl}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research_id: job.id,
          topic: job.topic,
        }),
      });

      if (!aiResponse.ok) {
        console.warn(
          `AI service responded with status ${aiResponse.status} for job ${job.id}`
        );
      }
    } catch (aiErr) {
      console.warn(
        'AI service could not be reached immediately. Job remains queued:',
        aiErr
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error('Error in research API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: jobs, error } = await supabase
      .from('research_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
