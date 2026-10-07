import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const format = request.nextUrl.searchParams.get('format') || 'pdf';
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const res = await fetch(`${aiServiceUrl}/research/${id}/export?format=${encodeURIComponent(format)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail || 'Export failed' },
        { status: res.status }
      );
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = res.headers.get('content-disposition') || `attachment; filename="report.${format}"`;

    const blob = await res.blob();
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error: any) {
    console.error('Document export error:', error);
    return NextResponse.json({ error: error.message || 'Export error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const res = await fetch(`${aiServiceUrl}/research/${id}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail || 'Export failed' },
        { status: res.status }
      );
    }

    const contentType = res.headers.get('content-type') || 'application/pdf';
    const contentDisposition = res.headers.get('content-disposition') || `attachment; filename="${encodeURIComponent(body.title || 'export')}.pdf"`;

    const blob = await res.blob();
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error: any) {
    console.error('Custom document export error:', error);
    return NextResponse.json({ error: error.message || 'Export error' }, { status: 500 });
  }
}
