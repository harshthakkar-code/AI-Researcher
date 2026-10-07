import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: messages, error } = await supabase
      .from('session_messages')
      .select('*')
      .eq('research_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Error fetching messages from Supabase directly:', error.message);
      // Fallback to FastAPI
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const res = await fetch(`${aiServiceUrl}/research/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ messages: data.messages || [] });
      }
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error: any) {
    console.error('Error fetching session messages:', error);
    return NextResponse.json({ messages: [] });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { messageId, messageIds } = body;

    const supabase = createAdminClient();

    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      const { error } = await supabase
        .from('session_messages')
        .delete()
        .eq('research_id', id)
        .in('id', messageIds);

      if (error) {
        console.error('Error deleting messages by IDs:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ status: 'deleted', count: messageIds.length });
    }

    if (messageId) {
      // Find this message's created_at timestamp
      const { data: targetMsg } = await supabase
        .from('session_messages')
        .select('created_at')
        .eq('id', messageId)
        .single();

      if (targetMsg?.created_at) {
        // Rollback all messages created at or after this message
        const { error } = await supabase
          .from('session_messages')
          .delete()
          .eq('research_id', id)
          .gte('created_at', targetMsg.created_at);

        if (error) {
          console.error('Error rolling back messages:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ status: 'reverted' });
      } else {
        // Fallback: delete specific message by id
        await supabase
          .from('session_messages')
          .delete()
          .eq('id', messageId);
        return NextResponse.json({ status: 'deleted' });
      }
    }

    return NextResponse.json({ error: 'messageId or messageIds is required' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in DELETE session messages:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
