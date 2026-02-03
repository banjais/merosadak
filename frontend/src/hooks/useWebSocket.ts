import { useState, useEffect, useCallback, useRef } from 'react';
import { APP_CONFIG } from '../config/config';
import { alertService } from '../services/alertService';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    // Construct WebSocket URL
    const baseUrl = APP_CONFIG.apiBaseUrl || window.location.origin;
    const wsProto = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = baseUrl.startsWith('http') 
        ? `${baseUrl.replace(/^http/, 'ws')}/ws/live`
        : `${wsProto}://${window.location.host}/ws/live`;

    console.log(`[WS] Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        
        // Handle system broadcasts
        if (data.type === 'system' && data.message !== 'Sadak-Sathi Live Stream Active') {
          alertService.notify(data.level || 'info', data.message);
        }
        
        // Handle data updates
        if (data.type === 'data_update') {
          console.log(`[WS] Data update received: ${data.dataType}`);
          // You could trigger a refresh here if needed
        }
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setIsConnected(false);
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = window.setTimeout(connect, 5000);
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      ws.close();
    };

    socketRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
}
