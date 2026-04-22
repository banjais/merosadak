import { useState, useEffect, useRef, useCallback } from 'react';

// Define types for WebSocket messages
export type WebSocketMessage =
  | { type: 'ghost_update'; userId: string; lat: number; lng: number; heading: number; speed: number; safetyScore?: number; mechanicalStress?: number }
  | { type: 'ghost_locations'; users: Array<{ lat: number; lng: number; id: string }> }
  | { type: 'progress'; message: string; pct: number }
  | { type: 'road_update'; message: string; timestamp: string; count: number }
  | { type: 'system'; message: string }
  | { type: string;[key: string]: any }; // Generic fallback for other messages

export type SendMessage = (message: WebSocketMessage) => void;

export const useWebSocket = (url: string) => {
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('[WebSocket] Connected');
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);
      } catch (e) {
        console.error('[WebSocket] Failed to parse message:', e);
      }
    };

    ws.current.onclose = (event) => {
      console.warn('[WebSocket] Disconnected:', event.code, event.reason);
      if (!event.wasClean) {
        console.log('[WebSocket] Attempting to reconnect in 5 seconds...');
        reconnectTimeout.current = setTimeout(connect, 5000);
      }
    };

    ws.current.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      ws.current?.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.close(1000, 'Component unmounted');
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connect]);

  const sendMessage: SendMessage = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Not connected, message not sent:', message);
    }
  }, []);

  return { lastMessage, sendMessage };
};