/**
 * useChatWebSocket Hook
 * Provides real-time WebSocket communication for chat features
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const WS_RECONNECT_DELAY = 3000;
const WS_PING_INTERVAL = 30000;

/**
 * Custom hook for managing WebSocket connection for chat
 * @param {string} chatId - The ID of the chat to connect to
 * @param {Object} options - Configuration options
 * @param {function} options.onMessage - Callback when a new message is received
 * @param {function} options.onTyping - Callback when typing status changes
 * @param {function} options.onStatus - Callback when message status changes
 * @param {function} options.onOnline - Callback when user online status changes
 * @param {boolean} options.enabled - Whether WebSocket should be connected
 */
export const useChatWebSocket = (chatId, options = {}) => {
  const {
    onMessage,
    onTyping,
    onStatus,
    onOnline,
    enabled = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const isUnmountedRef = useRef(false);

  // Get WebSocket URL based on current environment
  const getWebSocketUrl = useCallback(() => {
    const token = localStorage.getItem('zion_token');
    if (!token || !chatId) return null;

    // Get the backend URL and convert to WebSocket URL
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    
    // Handle different URL formats
    let wsUrl;
    if (backendUrl.startsWith('https://')) {
      wsUrl = backendUrl.replace('https://', 'wss://');
    } else if (backendUrl.startsWith('http://')) {
      wsUrl = backendUrl.replace('http://', 'ws://');
    } else {
      // Fallback to current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}`;
    }

    return `${wsUrl}/ws/chat/${chatId}?token=${token}`;
  }, [chatId]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'message':
          if (onMessage) onMessage(data.message);
          break;
        case 'typing':
          if (onTyping) onTyping(data);
          break;
        case 'status':
          if (onStatus) onStatus(data);
          break;
        case 'online':
          if (onOnline) onOnline(data);
          break;
        case 'pong':
          // Keep-alive response, do nothing
          break;
        default:
          console.log('Unknown WebSocket message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [onMessage, onTyping, onStatus, onOnline]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (isUnmountedRef.current || !enabled) return;

    const url = getWebSocketUrl();
    if (!url) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to chat:', chatId);
        setIsConnected(true);
        setConnectionError(null);

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, WS_PING_INTERVAL);
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnection if not intentionally closed
        if (!isUnmountedRef.current && enabled && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting WebSocket reconnection...');
            connect();
          }, WS_RECONNECT_DELAY);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionError('Failed to connect');
    }
  }, [chatId, enabled, getWebSocketUrl, handleMessage]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounted');
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Send typing status
  const sendTyping = useCallback((isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        is_typing: isTyping
      }));
    }
  }, []);

  // Send read status for messages
  const sendRead = useCallback((messageIds) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && messageIds?.length > 0) {
      wsRef.current.send(JSON.stringify({
        type: 'read',
        message_ids: messageIds
      }));
    }
  }, []);

  // Send delivered status for messages
  const sendDelivered = useCallback((messageIds) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && messageIds?.length > 0) {
      wsRef.current.send(JSON.stringify({
        type: 'delivered',
        message_ids: messageIds
      }));
    }
  }, []);

  // Connect/reconnect when chatId or enabled changes
  useEffect(() => {
    isUnmountedRef.current = false;

    if (chatId && enabled) {
      connect();
    }

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [chatId, enabled, connect, disconnect]);

  return {
    isConnected,
    connectionError,
    sendTyping,
    sendRead,
    sendDelivered,
    reconnect: connect,
    disconnect
  };
};

export default useChatWebSocket;
