import { useState, useEffect, useRef, useCallback } from 'react';

type MessageData = any;

export const useWebSocket = (url: string = 'ws://localhost:8080') => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  const connectAttemptRef = useRef(0);

  // Safe browser check
  const isBrowser = typeof window !== 'undefined';

  useEffect(() => {
    if (!isBrowser) return;

    let isMounted = true;
    const attemptId = ++connectAttemptRef.current;

    const cleanup = () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        wsRef.current = null;
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
    };

    const connect = () => {
      if (!isMounted || connectAttemptRef.current !== attemptId) return;

      cleanup();

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.warn('[WebSocket] Failed to create connection, retrying in 3s...');
        reconnectTimeout.current = window.setTimeout(connect, 3000);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted || connectAttemptRef.current !== attemptId) {
          ws.close();
          return;
        }
        setIsConnected(true);
        console.log('[WebSocket] Connected');
      };

      ws.onclose = () => {
        if (!isMounted || connectAttemptRef.current !== attemptId) return;
        setIsConnected(false);
        console.log('[WebSocket] Disconnected, retrying in 3s...');
        reconnectTimeout.current = window.setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // Error events are normal when server is unavailable; don't log verbosely
      };

      ws.onmessage = (event) => {
        if (!isMounted || connectAttemptRef.current !== attemptId) return;
        try {
          const data = JSON.parse(event.data);
          setMessages((prev) => [...prev, data]);
        } catch {
          console.warn('[WebSocket] Non-JSON message:', event.data);
        }
      };
    };

    // Small delay to avoid React StrictMode double-mount race
    const delayTimer = window.setTimeout(connect, 50);

    return () => {
      isMounted = false;
      clearTimeout(delayTimer);
      cleanup();
    };
  }, [url, isBrowser]);

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send, connection not open');
    }
  }, []);

  return { isConnected, messages, sendMessage };
};
