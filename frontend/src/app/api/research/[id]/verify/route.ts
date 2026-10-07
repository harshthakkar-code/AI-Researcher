import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const res = await fetch(`${aiServiceUrl}/research/${id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail || 'Failed to start deep verification' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 202 });
  } catch (error: any) {
    console.error('Error starting verification pipeline:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const res = await fetch(`${aiServiceUrl}/research/${id}/verification`);
    if (!res.ok) {
      return NextResponse.json({ job: null, results: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching verification status:', error);
    return NextResponse.json({ job: null, results: [] }, { status: 500 });
  }
}
