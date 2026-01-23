/**
 * Tests for useChatWebSocket Hook
 * Tests WebSocket connection management, message handling, and reconnection
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatWebSocket } from '../hooks/useChatWebSocket';

// Mock the config
jest.mock('../config/api', () => ({
  BACKEND_URL: 'https://test-api.example.com',
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  default: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useChatWebSocket', () => {
  let mockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.getItem.mockReturnValue('test-token');

    // Reset WebSocket mock
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
    };

    global.WebSocket = jest.fn().mockImplementation((url) => {
      mockWebSocket.url = url;
      // Trigger onopen asynchronously
      setTimeout(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen({ type: 'open' });
        }
      }, 0);
      return mockWebSocket;
    });
  });

  describe('Connection Management', () => {
    test('connects to WebSocket with correct URL', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('wss://test-api.example.com/api/ws/chat/chat-123')
        );
      });
    });

    test('includes token in WebSocket URL', async () => {
      renderHook(() => useChatWebSocket('chat-123', { enabled: true }));

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('token=test-token')
        );
      });
    });

    test('does not connect when enabled is false', () => {
      renderHook(() =>
        useChatWebSocket('chat-123', { enabled: false })
      );

      expect(global.WebSocket).not.toHaveBeenCalled();
    });

    test('does not connect when chatId is null', () => {
      renderHook(() =>
        useChatWebSocket(null, { enabled: true })
      );

      expect(global.WebSocket).not.toHaveBeenCalled();
    });

    test('does not connect when token is missing', () => {
      localStorage.getItem.mockReturnValue(null);

      renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      expect(global.WebSocket).not.toHaveBeenCalled();
    });

    test('sets isConnected to true when connected', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });

    test('disconnects when unmounted', async () => {
      const { unmount } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalled();
      });

      unmount();

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Component unmounted');
    });
  });

  describe('Message Handling', () => {
    test('calls onMessage callback for message events', async () => {
      const onMessage = jest.fn();

      renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true, onMessage })
      );

      await waitFor(() => {
        expect(mockWebSocket.onmessage).toBeDefined();
      });

      // Simulate receiving a message
      act(() => {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'message',
            message: { id: 'msg-1', content: 'Hello' },
          }),
        });
      });

      expect(onMessage).toHaveBeenCalledWith({ id: 'msg-1', content: 'Hello' });
    });

    test('calls onTyping callback for typing events', async () => {
      const onTyping = jest.fn();

      renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true, onTyping })
      );

      await waitFor(() => {
        expect(mockWebSocket.onmessage).toBeDefined();
      });

      act(() => {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'typing',
            user_id: 'user-123',
            is_typing: true,
          }),
        });
      });

      expect(onTyping).toHaveBeenCalledWith({
        type: 'typing',
        user_id: 'user-123',
        is_typing: true,
      });
    });

    test('calls onStatus callback for status events', async () => {
      const onStatus = jest.fn();

      renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true, onStatus })
      );

      await waitFor(() => {
        expect(mockWebSocket.onmessage).toBeDefined();
      });

      act(() => {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'status',
            message_id: 'msg-1',
            status: 'read',
          }),
        });
      });

      expect(onStatus).toHaveBeenCalled();
    });

    test('calls onOnline callback for online events', async () => {
      const onOnline = jest.fn();

      renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true, onOnline })
      );

      await waitFor(() => {
        expect(mockWebSocket.onmessage).toBeDefined();
      });

      act(() => {
        mockWebSocket.onmessage({
          data: JSON.stringify({
            type: 'online',
            user_id: 'user-123',
            is_online: true,
          }),
        });
      });

      expect(onOnline).toHaveBeenCalled();
    });

    test('handles pong messages silently', async () => {
      const onMessage = jest.fn();

      renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true, onMessage })
      );

      await waitFor(() => {
        expect(mockWebSocket.onmessage).toBeDefined();
      });

      act(() => {
        mockWebSocket.onmessage({
          data: JSON.stringify({ type: 'pong' }),
        });
      });

      expect(onMessage).not.toHaveBeenCalled();
    });

    test('handles malformed JSON gracefully', async () => {
      const logger = require('../utils/logger').default;

      renderHook(() => useChatWebSocket('chat-123', { enabled: true }));

      await waitFor(() => {
        expect(mockWebSocket.onmessage).toBeDefined();
      });

      act(() => {
        mockWebSocket.onmessage({
          data: 'invalid json',
        });
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error parsing WebSocket message:',
        expect.any(Error)
      );
    });
  });

  describe('Sending Messages', () => {
    test('sendTyping sends typing status', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendTyping(true);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'typing', is_typing: true })
      );
    });

    test('sendTyping with false clears typing status', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendTyping(false);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'typing', is_typing: false })
      );
    });

    test('sendRead sends read receipt', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendRead(['msg-1', 'msg-2']);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'read', message_ids: ['msg-1', 'msg-2'] })
      );
    });

    test('sendRead does nothing for empty array', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendRead([]);
      });

      // send should not be called for empty array
      expect(mockWebSocket.send).not.toHaveBeenCalledWith(
        expect.stringContaining('read')
      );
    });

    test('sendDelivered sends delivered receipt', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendDelivered(['msg-1']);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'delivered', message_ids: ['msg-1'] })
      );
    });
  });

  describe('Error Handling', () => {
    test('sets connectionError on WebSocket error', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(mockWebSocket.onerror).toBeDefined();
      });

      act(() => {
        mockWebSocket.onerror({ type: 'error' });
      });

      expect(result.current.connectionError).toBe('Connection error');
    });

    test('sets isConnected to false on close', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        mockWebSocket.onclose({ code: 1000, reason: 'Normal closure' });
      });

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('Reconnection', () => {
    test('provides reconnect function', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.reconnect).toBeDefined();
      });

      expect(typeof result.current.reconnect).toBe('function');
    });

    test('provides disconnect function', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.disconnect).toBeDefined();
      });

      expect(typeof result.current.disconnect).toBe('function');
    });

    test('disconnect closes the connection', async () => {
      const { result } = renderHook(() =>
        useChatWebSocket('chat-123', { enabled: true })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.disconnect();
      });

      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('URL Generation', () => {
    test('converts https to wss', async () => {
      renderHook(() => useChatWebSocket('chat-123', { enabled: true }));

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('wss://')
        );
      });
    });

    test('converts http to ws for non-secure connections', async () => {
      jest.resetModules();
      jest.doMock('../config/api', () => ({
        BACKEND_URL: 'http://localhost:8000',
      }));

      // Re-import after mock
      const { useChatWebSocket: localHook } = require('../hooks/useChatWebSocket');

      renderHook(() => localHook('chat-123', { enabled: true }));

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('ws://')
        );
      });
    });
  });
});
