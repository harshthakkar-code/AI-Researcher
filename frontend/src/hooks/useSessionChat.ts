'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SessionMessage } from '@/types';

interface UseSessionChatOptions {
  onReportUpdated?: (newMarkdown: string) => void;
  isJobResearching?: boolean;
}

export function useSessionChat(researchId: string, options?: UseSessionChatOptions) {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIntents, setActiveIntents] = useState<string[]>([]);

  // Keep latest options in ref to avoid re-triggering effects on inline object changes
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const fetchMessages = useCallback(async () => {
    if (!researchId) return;
    try {
      const res = await fetch(`/api/research/${researchId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const serverMessages: SessionMessage[] = data.messages || [];
        setMessages((prev) => {
          // Keep only temporary optimistic messages that have not yet appeared in serverMessages
          const pendingTemps = prev.filter(
            (p) =>
              p.id.startsWith('temp-') &&
              !serverMessages.some(
                (s) => s.role === p.role && s.content.trim() === p.content.trim()
              )
          );
          return [...serverMessages, ...pendingTemps];
        });

        // If the latest message from server is from assistant, we are not actively sending
        if (serverMessages.length > 0 && serverMessages[serverMessages.length - 1].role === 'assistant') {
          setIsSending(false);
        }
      }
    } catch (err: any) {
      console.error('Failed to load session messages:', err);
    }
  }, [researchId]);

  // Initial fetch and Realtime subscription ONLY on researchId change
  useEffect(() => {
    fetchMessages();

    const supabase = createClient();
    if (!supabase) return;

    // Realtime channel for new and deleted session messages
    const channel = supabase
      .channel(`chat-${researchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_messages',
          filter: `research_id=eq.${researchId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) {
              setMessages((prev) => prev.filter((m) => m.id !== oldId));
            }
            return;
          }

          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as SessionMessage;
            setMessages((prev) => {
              // 1. If message already exists by ID, do nothing
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev;
              }

              // 2. If an optimistic temp message exists for this user message, swap it in-place
              const tempIndex = prev.findIndex(
                (m) =>
                  m.id.startsWith('temp-') &&
                  m.role === newMsg.role &&
                  m.content.trim() === newMsg.content.trim()
              );

              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = newMsg;
                return updated;
              }

              // 3. Otherwise append new message
              return [...prev, newMsg];
            });

            // If assistant message arrived, clear sending state and trigger callbacks
            if (newMsg.role === 'assistant') {
              setIsSending(false);
              if (newMsg.metadata?.intents) {
                setActiveIntents(newMsg.metadata.intents);
              }
              if (newMsg.metadata?.report_updated && optionsRef.current?.onReportUpdated) {
                optionsRef.current.onReportUpdated(newMsg.metadata?.new_report_markdown || '');
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [researchId, fetchMessages]);

  // Active check interval ONLY while waiting for an assistant response
  useEffect(() => {
    if (!isSending) return;

    const interval = setInterval(() => {
      fetchMessages();
    }, 2000);

    return () => clearInterval(interval);
  }, [isSending, fetchMessages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setError(null);
    setIsSending(true);

    // Optimistic local placeholder for immediate user feedback
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMsg: SessionMessage = {
      id: optimisticId,
      research_id: researchId,
      role: 'user',
      content: trimmed,
      message_type: 'text',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch(`/api/research/${researchId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to dispatch research action');
      }

      // Backend returns 202 Accepted immediately. The agent pipeline runs in the background.
      // Realtime subscription and active 2s polling interval will receive the assistant message when ready.
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Error communicating with research assistant');
      setIsSending(false);
      // Remove optimistic message on dispatch failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }
  };

  const revertFromMessage = async (messageId: string) => {
    // Optimistic rollback from thread
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx !== -1) {
        return prev.slice(0, idx);
      }
      return prev.filter((m) => m.id !== messageId);
    });

    try {
      const res = await fetch(`/api/research/${researchId}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to rollback messages');
      }
    } catch (err: any) {
      console.error('Error rolling back messages:', err);
      await fetchMessages(); // revert on failure
      throw err;
    }
  };

  // Determine whether the session is currently generating an assistant response
  const isGenerating = useMemo(() => {
    // If the latest message in the thread is already from the assistant, we are NOT generating
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      return false;
    }
    if (isSending) return true;
    if (options?.isJobResearching) return true;
    return false;
  }, [messages, isSending, options?.isJobResearching]);

  return {
    messages,
    isSending: isGenerating,
    error,
    activeIntents,
    sendMessage,
    revertFromMessage,
    reloadMessages: fetchMessages,
  };
}
