import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, BellRing, X, Check, CheckCheck, Trash2, Bot, Star, Heart, 
  MessageCircle, Users, Calendar, Sparkles, ExternalLink
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const NotificationDropdown = ({ isOpen, onClose, onOpenEricChat }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    // Initial fetch
    fetchUnreadCount();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/notifications?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('zion_token');
      await fetch(`${BACKEND_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      await fetch(`${BACKEND_URL}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const token = localStorage.getItem('zion_token');
      await fetch(`${BACKEND_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    // Handle different notification types
    if (notification.type === 'eric_recommendation' || notification.type === 'eric_analysis') {
      // Open ERIC chat
      onOpenEricChat?.();
      onClose();
    } else if (notification.related_post_id) {
      // Navigate to post (would need router)
      onClose();
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'eric_recommendation':
        return <Sparkles size={18} className="text-yellow-500" />;
      case 'eric_analysis':
        return <Bot size={18} className="text-purple-500" />;
      case 'like':
        return <Heart size={18} className="text-red-500" />;
      case 'comment':
      case 'reply':
        return <MessageCircle size={18} className="text-blue-500" />;
      case 'mention':
        return <Users size={18} className="text-green-500" />;
      default:
        return <Bell size={18} className="text-gray-500" />;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60 * 1000) return 'только что';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} мин`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} ч`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  if (!isOpen) {
    return (
      <div style={{ position: 'relative' }}>
        <button 
          className="header-action-btn"
          onClick={() => onClose(false)}
          title="Уведомления"
          style={{ position: 'relative' }}
        >
          {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#EF4444',
              color: 'white',
              fontSize: 10,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        className="header-action-btn"
        style={{ 
          background: 'rgba(255, 217, 61, 0.2)',
          position: 'relative'
        }}
      >
        <BellRing size={18} style={{ color: '#F59E0B' }} />
      </button>

      {/* Dropdown */}
      <div style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 360,
        maxHeight: 480,
        background: 'white',
        borderRadius: 16,
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        zIndex: 9999,
        animation: 'slideDown 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Уведомления</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                <CheckCheck size={14} />
                Прочитать все
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 8
              }}
            >
              <X size={18} color="#9ca3af" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div style={{ 
          maxHeight: 400, 
          overflowY: 'auto',
          padding: '8px 0'
        }}>
          {loading ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: 40,
              color: '#9ca3af'
            }}>
              <div style={{
                width: 24,
                height: 24,
                border: '2px solid #e5e7eb',
                borderTopColor: '#F59E0B',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          ) : notifications.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              color: '#9ca3af'
            }}>
              <Bell size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: 14 }}>Нет уведомлений</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 20px',
                  cursor: 'pointer',
                  background: notification.is_read ? 'transparent' : 'rgba(255, 217, 61, 0.08)',
                  borderLeft: notification.is_read ? 'none' : '3px solid #F59E0B',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = notification.is_read ? 'transparent' : 'rgba(255, 217, 61, 0.08)'}
              >
                {/* Icon */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: notification.type.startsWith('eric_') 
                    ? 'linear-gradient(135deg, #FFD93D 0%, #FF9500 100%)'
                    : '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {notification.type.startsWith('eric_') ? (
                    <Bot size={18} color="white" />
                  ) : (
                    getNotificationIcon(notification.type)
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ 
                    margin: 0, 
                    fontSize: 14, 
                    fontWeight: notification.is_read ? 400 : 600,
                    color: '#111827'
                  }}>
                    {notification.title}
                  </p>
                  <p style={{ 
                    margin: '4px 0 0', 
                    fontSize: 13, 
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {notification.message}
                  </p>
                  <p style={{ 
                    margin: '6px 0 0', 
                    fontSize: 11, 
                    color: '#9ca3af' 
                  }}>
                    {formatTime(notification.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {!notification.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      style={{
                        padding: 6,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 6,
                        opacity: 0.6
                      }}
                      title="Отметить как прочитанное"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    style={{
                      padding: 6,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 6,
                      opacity: 0.6
                    }}
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ERIC Promo Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, rgba(255, 217, 61, 0.1) 0%, rgba(255, 149, 0, 0.1) 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFD93D 0%, #FF9500 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={16} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#92400E' }}>
              ERIC отправит уведомление
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#B45309' }}>
              когда найдёт рекомендации для вас
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NotificationDropdown;
