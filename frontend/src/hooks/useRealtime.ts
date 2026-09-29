import { useEffect, useRef } from 'react';
import { AgentStep, RequestItem, PolicyItem, AuditEvent } from '../types.js';

interface UseRealtimeOptions {
  onAgentStep?: (step: AgentStep) => void;
  onRequestCreated?: (request: RequestItem) => void;
  onRequestUpdated?: (request: RequestItem) => void;
  onRequestDeleted?: (data: { id: string }) => void;
  onPolicyCreated?: (policy: PolicyItem) => void;
  onActivityLogged?: (event: AuditEvent) => void;
  token?: string | null;
}

export function useRealtime({
  onAgentStep,
  onRequestCreated,
  onRequestUpdated,
  onRequestDeleted,
  onPolicyCreated,
  onActivityLogged,
  token,
}: UseRealtimeOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) return;

    const url = `/api/realtime/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('agent_step', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (onAgentStep) onAgentStep(payload.data || payload);
      } catch (err) {
        console.error('Error parsing agent_step SSE:', err);
      }
    });

    es.addEventListener('request_created', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (onRequestCreated) onRequestCreated(payload.data || payload);
      } catch (err) {
        console.error('Error parsing request_created SSE:', err);
      }
    });

    es.addEventListener('request_updated', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (onRequestUpdated) onRequestUpdated(payload.data || payload);
      } catch (err) {
        console.error('Error parsing request_updated SSE:', err);
      }
    });

    es.addEventListener('request_deleted', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (onRequestDeleted) onRequestDeleted(payload.data || payload);
      } catch (err) {
        console.error('Error parsing request_deleted SSE:', err);
      }
    });

    es.addEventListener('policy_created', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (onPolicyCreated) onPolicyCreated(payload.data || payload);
      } catch (err) {
        console.error('Error parsing policy_created SSE:', err);
      }
    });

    es.addEventListener('activity_logged', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (onActivityLogged) onActivityLogged(payload.data || payload);
      } catch (err) {
        console.error('Error parsing activity_logged SSE:', err);
      }
    });

    es.onerror = () => {
      // EventSource auto-retries internally
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [token, onAgentStep, onRequestCreated, onRequestUpdated, onRequestDeleted, onPolicyCreated, onActivityLogged]);
}
