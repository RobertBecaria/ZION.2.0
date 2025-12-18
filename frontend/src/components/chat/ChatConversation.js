/**
 * ChatConversation Component
 * WhatsApp-style chat conversation view with WebSocket real-time updates
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Smile, Paperclip, ArrowLeft, MoreVertical, Search, User, X, Image, File, Wifi, WifiOff, ChevronDown
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import { useChatWebSocket } from '../../hooks';

// WebSocket connection indicator component - defined outside to avoid re-creation
const ConnectionIndicator = ({ isConnected }) => (
  <div 
    className={`ws-connection-indicator ${isConnected ? 'connected' : 'disconnected'}`} 
    title={isConnected ? 'Подключено' : 'Переподключение...'}
  >
    {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
  </div>
);

const ChatConversation = ({
  chat,
  chatType = 'direct', // 'direct' or 'group'
  onBack,
  moduleColor = '#059669',
  user
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  // Pagination state for infinite scroll
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const MESSAGES_PER_PAGE = 50;
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [userStatus, setUserStatus] = useState({ is_online: false, last_seen: null });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(false);

  const chatId = chatType === 'direct' ? chat?.chat?.id : chat?.group?.id;
  const otherUserId = chatType === 'direct' ? chat?.other_user?.id : null;
  const chatName = chatType === 'direct' 
    ? `${chat?.other_user?.first_name || ''} ${chat?.other_user?.last_name || ''}`.trim() || 'Unknown'
    : chat?.group?.name || 'Unknown Group';
  const chatAvatar = chatType === 'direct' 
    ? chat?.other_user?.profile_picture 
    : null;

  // Track pending delivery notifications for messages received via WebSocket
  const [pendingDelivery, setPendingDelivery] = useState([]);

  // WebSocket integration
  const {
    isConnected: wsConnected,
    sendTyping: wsSendTyping,
    sendRead: wsSendRead,
    sendDelivered: wsSendDelivered
  } = useChatWebSocket(chatId, {
    enabled: !!chatId,
    onMessage: useCallback((newMsg) => {
      // Add new message to the list if not already present
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      
      // Queue delivery notification for messages from other users
      if (newMsg.user_id !== user?.id) {
        setPendingDelivery(prev => [...prev, newMsg.id]);
      }
    }, [user?.id]),
    onTyping: useCallback((data) => {
      if (data.user_id === user?.id) return;
      
      setTypingUsers(prev => {
        if (data.is_typing) {
          if (!prev.some(u => u.user_id === data.user_id)) {
            return [...prev, { user_id: data.user_id, user_name: data.user_name }];
          }
        } else {
          return prev.filter(u => u.user_id !== data.user_id);
        }
        return prev;
      });
    }, [user?.id]),
    onStatus: useCallback((data) => {
      // Update message status (delivered/read)
      setMessages(prev => prev.map(msg => 
        msg.id === data.message_id 
          ? { ...msg, status: data.status }
          : msg
      ));
    }, []),
    onOnline: useCallback((data) => {
      if (data.user_id === otherUserId) {
        setUserStatus(prev => ({
          ...prev,
          is_online: data.is_online,
          last_seen: data.is_online ? null : new Date().toISOString()
        }));
      }
    }, [otherUserId])
  });

  // Send delivery notifications for pending messages
  useEffect(() => {
    if (pendingDelivery.length > 0 && wsSendDelivered) {
      wsSendDelivered(pendingDelivery);
      setPendingDelivery([]);
    }
  }, [pendingDelivery, wsSendDelivered]);

  const scrollToBottom = useCallback((force = false) => {
    if (!messagesContainerRef.current) return;
    
    // Only auto-scroll if user is near the bottom OR if forced (new message sent/received)
    const container = messagesContainerRef.current;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    // If user scrolled up more than 150px, don't auto-scroll (unless forced)
    if (distanceFromBottom > 150 && !force) {
      return;
    }
    
    // Use container scroll instead of scrollIntoView to prevent header from scrolling out
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, []);

  // Fetch messages - used for initial load and fallback polling
  const fetchMessages = useCallback(async (isInitial = true) => {
    if (!chatId) return;
    try {
      const token = localStorage.getItem('zion_token');
      const endpoint = chatType === 'direct' 
        ? `/api/direct-chats/${chatId}/messages`
        : `/api/chat-groups/${chatId}/messages`;
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}?limit=${MESSAGES_PER_PAGE}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        const fetchedMessages = data.messages || [];
        setMessages(fetchedMessages);
        setHasMoreMessages(fetchedMessages.length >= MESSAGES_PER_PAGE);
        
        // Mark unread messages as read via WebSocket
        const unreadMessages = fetchedMessages
          .filter(m => m.user_id !== user?.id && m.status !== 'read')
          .map(m => m.id);
        if (unreadMessages.length > 0 && wsConnected) {
          wsSendRead(unreadMessages);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [chatId, chatType, user?.id, wsConnected, wsSendRead, MESSAGES_PER_PAGE]);

  // Load more messages (older) for infinite scroll
  const loadMoreMessages = useCallback(async () => {
    if (!chatId || loadingMore || !hasMoreMessages) return;
    
    setLoadingMore(true);
    try {
      const token = localStorage.getItem('zion_token');
      const endpoint = chatType === 'direct' 
        ? `/api/direct-chats/${chatId}/messages`
        : `/api/chat-groups/${chatId}/messages`;
      
      // Skip the current number of messages to load older ones
      const skip = messages.length;
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}?skip=${skip}&limit=${MESSAGES_PER_PAGE}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        const olderMessages = data.messages || [];
        
        if (olderMessages.length > 0) {
          // Prepend older messages to the beginning
          setMessages(prev => [...olderMessages, ...prev]);
        }
        setHasMoreMessages(olderMessages.length >= MESSAGES_PER_PAGE);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, chatType, messages.length, loadingMore, hasMoreMessages, MESSAGES_PER_PAGE]);

  // Initial fetch and fallback polling when WebSocket is not connected
  useEffect(() => {
    if (chatId) {
      fetchMessages();
      // Use longer polling interval when WebSocket is connected, shorter when not
      const pollInterval = wsConnected ? 30000 : 3000;
      const interval = setInterval(fetchMessages, pollInterval);
      return () => clearInterval(interval);
    }
  }, [chatId, wsConnected, fetchMessages]);

  // Keep track of message count to detect new messages
  const prevMessageCountRef = useRef(0);
  const initialScrollDoneRef = useRef(false);
  
  // Scroll to bottom only on initial load, not when sending/receiving messages
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    
    // Only scroll on initial load (when we first get messages)
    if (prevCount === 0 && currentCount > 0 && !initialScrollDoneRef.current) {
      // Initial load - scroll to bottom with a small delay to ensure DOM is ready
      initialScrollDoneRef.current = true;
      setTimeout(() => {
        // Use container scroll instead of scrollIntoView to prevent header from scrolling out
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);
    }
    // Don't auto-scroll for new messages - let user control scroll position
    
    prevMessageCountRef.current = currentCount;
  }, [messages]);
  
  // Reset initial scroll flag when chat changes
  useEffect(() => {
    initialScrollDoneRef.current = false;
    prevMessageCountRef.current = 0;
  }, [chatId]);

  // Fetch typing status (fallback for when WebSocket is not connected)
  useEffect(() => {
    if (chatId && !wsConnected) {
      const fetchTypingStatus = async () => {
        try {
          const token = localStorage.getItem('zion_token');
          const response = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/chats/${chatId}/typing?chat_type=${chatType}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (response.ok) {
            const data = await response.json();
            setTypingUsers(data.typing_users || []);
          }
        } catch (error) {
          console.error('Error fetching typing status:', error);
        }
      };
      
      const typingInterval = setInterval(fetchTypingStatus, 2000);
      return () => clearInterval(typingInterval);
    }
  }, [chatId, chatType, wsConnected]);

  // Fetch user online status for direct chats
  useEffect(() => {
    if (chatType === 'direct' && otherUserId) {
      const fetchUserStatus = async () => {
        try {
          const token = localStorage.getItem('zion_token');
          const response = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/users/${otherUserId}/status`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (response.ok) {
            const data = await response.json();
            setUserStatus(data);
          }
        } catch (error) {
          console.error('Error fetching user status:', error);
        }
      };
      
      fetchUserStatus();
      const statusInterval = setInterval(fetchUserStatus, 30000);
      return () => clearInterval(statusInterval);
    }
  }, [otherUserId, chatType]);

  // Send heartbeat to update own online status
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const token = localStorage.getItem('zion_token');
        await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/heartbeat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    };
    
    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(heartbeatInterval);
  }, []);

  // Set typing status (via WebSocket if connected, otherwise via HTTP)
  const setTypingStatus = useCallback(async (isTyping) => {
    if (!chatId) return;
    
    // Use WebSocket if connected
    if (wsConnected) {
      wsSendTyping(isTyping);
      return;
    }
    
    // Fallback to HTTP
    try {
      const token = localStorage.getItem('zion_token');
      await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chats/${chatId}/typing?chat_type=${chatType}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ is_typing: isTyping })
        }
      );
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  }, [chatId, chatType, wsConnected, wsSendTyping]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    if (!lastTypingSentRef.current) {
      setTypingStatus(true);
      lastTypingSentRef.current = true;
    }
    
    // Clear and reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
      lastTypingSentRef.current = false;
    }, 2000);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || sending) return;

    setSending(true);
    setTypingStatus(false);
    
    try {
      const token = localStorage.getItem('zion_token');
      const endpoint = chatType === 'direct'
        ? `/api/direct-chats/${chatId}/messages`
        : `/api/chat-groups/${chatId}/messages`;
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content: newMessage,
            message_type: 'TEXT',
            reply_to: replyingTo?.id || null
          })
        }
      );

      if (response.ok) {
        setNewMessage('');
        setReplyingTo(null);
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;
    
    setUploadingFile(true);
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('content', file.name);
      if (replyingTo) {
        formData.append('reply_to', replyingTo.id);
      }
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/direct-chats/${chatId}/messages/attachment`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        }
      );
      
      if (response.ok) {
        setReplyingTo(null);
        fetchMessages();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !chatId) return;
    
    setSearching(true);
    try {
      const token = localStorage.getItem('zion_token');
      const endpoint = chatType === 'direct'
        ? `/api/direct-chats/${chatId}/messages/search`
        : `/api/chat-groups/${chatId}/messages/search`;
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}?query=${encodeURIComponent(searchQuery)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.messages || []);
      }
    } catch (error) {
      console.error('Error searching messages:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Handle message reaction
  const handleReaction = async (messageId, emoji) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/messages/${messageId}/react`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ emoji })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        // Update message in state
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, reactions: data.reactions, user_reaction: data.user_reaction }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error reacting to message:', error);
    }
  };

  // Handle message edit
  const handleEditMessage = async () => {
    if (!editingMessage || !editContent.trim()) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/messages/${editingMessage.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content: editContent })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => prev.map(msg => 
          msg.id === editingMessage.id 
            ? { ...msg, content: editContent, is_edited: true }
            : msg
        ));
        setEditingMessage(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  // Handle message delete
  const handleDeleteMessage = async (message) => {
    if (!window.confirm('Удалить это сообщение?')) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/messages/${message.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        setMessages(prev => prev.map(msg => 
          msg.id === message.id 
            ? { ...msg, is_deleted: true, content: '' }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  // Open edit modal
  const openEditModal = (message) => {
    setEditingMessage(message);
    setEditContent(message.content);
  };

  // Handle emoji selection for message input
  const handleEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Handle scroll to detect when to show scroll button
  const handleScroll = (e) => {
    const container = e.target;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollButton(distanceFromBottom > 200);
  };

  // Send voice message
  const sendVoiceMessage = async (audioBlob, duration) => {
    if (!audioBlob || !chatId) return;
    
    setSendingVoice(true);
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      
      // Create a filename with timestamp
      const filename = `voice_${Date.now()}.webm`;
      formData.append('file', audioBlob, filename);
      formData.append('content', `🎤 Голосовое сообщение (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`);
      formData.append('message_type', 'VOICE');
      formData.append('duration', duration.toString());
      
      if (replyingTo) {
        formData.append('reply_to', replyingTo.id);
      }
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/direct-chats/${chatId}/messages/voice`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        }
      );
      
      if (response.ok) {
        setReplyingTo(null);
        setIsRecordingVoice(false);
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
    } finally {
      setSendingVoice(false);
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'был(а) давно';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'был(а) только что';
    if (diff < 3600000) return `был(а) ${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `был(а) ${Math.floor(diff / 3600000)} ч. назад`;
    return `был(а) ${date.toLocaleDateString('ru-RU')}`;
  };

  const getStatusText = () => {
    if (typingUsers.length > 0) return 'печатает...';
    if (chatType === 'group') return `${chat?.member_count || 0} участников`;
    if (userStatus.is_online) return 'в сети';
    return formatLastSeen(userStatus.last_seen);
  };

  if (!chat) {
    return (
      <div className="chat-conversation empty" style={{ backgroundColor: `${moduleColor}10` }}>
        <div className="empty-chat-placeholder">
          <User size={64} color="#9ca3af" />
          <h3>Выберите чат</h3>
          <p>Выберите чат из списка для начала общения</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-conversation" style={{ backgroundColor: `${moduleColor}10` }}>
      {/* Chat Header */}
      <div className="conversation-header" style={{ backgroundColor: `${moduleColor}10` }}>
        <button className="back-btn mobile-only" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
        
        <div className="chat-info">
          <div className="chat-avatar">
            {chatAvatar ? (
              <img src={chatAvatar} alt="" />
            ) : (
              <div className="avatar-placeholder" style={{ backgroundColor: moduleColor }}>
                {chatType === 'direct' 
                  ? (chat?.other_user?.first_name?.[0] || '?')
                  : (chat?.group?.name?.[0] || 'G')}
              </div>
            )}
            {chatType === 'direct' && userStatus.is_online && (
              <span className="online-indicator"></span>
            )}
          </div>
          <div className="chat-details">
            <h3>{chatName}</h3>
            <p className="chat-status">{getStatusText()}</p>
          </div>
        </div>
        
        <div className="header-actions">
          <ConnectionIndicator isConnected={wsConnected} />
          <button 
            className="action-btn" 
            title="Поиск"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={20} />
          </button>
          <button className="action-btn" title="Ещё">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="chat-search-panel">
          <input
            type="text"
            placeholder="Поиск сообщений..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={searching}>
            {searching ? '...' : 'Найти'}
          </button>
          <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="search-results-panel">
          <div className="search-results-header">
            <span>Найдено: {searchResults.length}</span>
            <button onClick={() => setSearchResults([])}>Закрыть</button>
          </div>
          {searchResults.map(msg => (
            <div key={msg.id} className="search-result-item">
              <strong>{msg.sender?.first_name}</strong>: {msg.content.substring(0, 50)}...
              <span className="result-time">
                {new Date(msg.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div 
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {loading && messages.length === 0 ? (
          <div className="loading-messages">
            <p>Загрузка сообщений...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <p>Нет сообщений</p>
            <small>Начните разговор, отправив первое сообщение</small>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwn = message.user_id === user?.id;
              const showSender = chatType === 'group' && !isOwn;
              const prevMessage = messages[index - 1];
              const nextMessage = messages[index + 1];
              
              // Date separator logic
              const showDate = !prevMessage || 
                new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString();
              
              // Message grouping logic - group consecutive messages from same sender within 2 minutes
              const timeDiff = prevMessage 
                ? (new Date(message.created_at) - new Date(prevMessage.created_at)) / 1000 / 60 
                : Infinity;
              const isFirstInGroup = !prevMessage || 
                prevMessage.user_id !== message.user_id || 
                timeDiff > 2 ||
                showDate;
              
              const nextTimeDiff = nextMessage 
                ? (new Date(nextMessage.created_at) - new Date(message.created_at)) / 1000 / 60 
                : Infinity;
              const isLastInGroup = !nextMessage || 
                nextMessage.user_id !== message.user_id || 
                nextTimeDiff > 2 ||
                (nextMessage && new Date(nextMessage.created_at).toDateString() !== new Date(message.created_at).toDateString());
              
              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="date-separator">
                      <span>{new Date(message.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: new Date(message.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })}</span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    isOwn={isOwn}
                    showSender={showSender && isFirstInGroup}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                    onReply={handleReply}
                    onReact={handleReaction}
                    onEdit={openEditModal}
                    onDelete={handleDeleteMessage}
                    moduleColor={moduleColor}
                  />
                </React.Fragment>
              );
            })}
            <TypingIndicator typingUsers={typingUsers} moduleColor={moduleColor} />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="reply-preview">
          <div className="reply-bar" style={{ backgroundColor: moduleColor }}></div>
          <div className="reply-content">
            <span className="reply-to-label">Ответ для {replyingTo.sender?.first_name || 'Unknown'}</span>
            <span className="reply-text">{replyingTo.content?.substring(0, 50)}...</span>
          </div>
          <button className="cancel-reply" onClick={cancelReply}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Message Input */}
      <form className="message-input-form" onSubmit={sendMessage}>
        {isRecordingVoice ? (
          <VoiceRecorder
            onSend={sendVoiceMessage}
            onCancel={() => setIsRecordingVoice(false)}
            moduleColor={moduleColor}
            disabled={sendingVoice}
          />
        ) : (
          <>
            <button 
              type="button" 
              className="input-action-btn" 
              title="Эмодзи"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile size={24} color={showEmojiPicker ? moduleColor : "#8696A0"} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <button 
              type="button" 
              className="input-action-btn" 
              title="Прикрепить файл"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              <Paperclip size={24} color={uploadingFile ? moduleColor : "#8696A0"} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder={uploadingFile ? "Загрузка файла..." : "Введите сообщение"}
              className="message-input"
              disabled={sending || uploadingFile}
            />
            {newMessage.trim() ? (
              <button
                type="submit"
                className="send-btn"
                disabled={sending || uploadingFile}
                style={{ backgroundColor: moduleColor }}
              >
                <Send size={20} />
              </button>
            ) : (
              <VoiceRecorder
                onSend={sendVoiceMessage}
                onCancel={() => {}}
                moduleColor={moduleColor}
                disabled={sending || uploadingFile || sendingVoice}
              />
            )}
          </>
        )}
      </form>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button 
          className="scroll-to-bottom-btn"
          onClick={() => scrollToBottom(true)}
          style={{ '--module-color': moduleColor }}
        >
          <ChevronDown size={20} />
        </button>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div style={{ position: 'absolute', bottom: '80px', left: '20px', zIndex: 1000 }}>
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
            moduleColor={moduleColor}
          />
        </div>
      )}

      {/* Edit Message Modal */}
      {editingMessage && (
        <>
          <div className="edit-message-overlay" onClick={() => setEditingMessage(null)} />
          <div className="edit-message-modal" style={{ '--module-color': moduleColor }}>
            <h3>Редактировать сообщение</h3>
            <textarea
              className="edit-message-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
            />
            <div className="edit-message-actions">
              <button className="edit-cancel-btn" onClick={() => setEditingMessage(null)}>
                Отмена
              </button>
              <button 
                className="edit-save-btn" 
                onClick={handleEditMessage}
                disabled={!editContent.trim() || editContent === editingMessage.content}
              >
                Сохранить
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatConversation;
