import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Calendar, Clock, Users, Settings, Smile, 
  Paperclip, Image, MoreHorizontal, Reply, Edit, Trash2,
  CheckCircle, AlertCircle, MapPin, UserPlus
} from 'lucide-react';

function UniversalChatLayout({ 
  activeGroup, 
  chatGroups, 
  onGroupSelect, 
  moduleColor = "#059669",
  onCreateGroup,
  user 
}) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [scheduledActions, setScheduledActions] = useState([]);
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionForm, setActionForm] = useState({
    title: '',
    description: '',
    action_type: 'REMINDER',
    scheduled_date: '',
    scheduled_time: '',
    location: '',
    invitees: []
  });
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (activeGroup) {
      fetchMessages();
      fetchScheduledActions();
    }
  }, [activeGroup]);

  const fetchMessages = async () => {
    if (!activeGroup) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chat-groups/${activeGroup.group.id}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchScheduledActions = async () => {
    if (!activeGroup) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chat-groups/${activeGroup.group.id}/scheduled-actions`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setScheduledActions(data.scheduled_actions || []);
      }
    } catch (error) {
      console.error('Error fetching scheduled actions:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeGroup || loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chat-groups/${activeGroup.group.id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            group_id: activeGroup.group.id,
            content: newMessage,
            message_type: 'TEXT'
          })
        }
      );

      if (response.ok) {
        setNewMessage('');
        fetchMessages(); // Refresh messages
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const createScheduledAction = async (e) => {
    e.preventDefault();
    if (!actionForm.title.trim() || !activeGroup || loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chat-groups/${activeGroup.group.id}/scheduled-actions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...actionForm,
            scheduled_date: new Date(actionForm.scheduled_date).toISOString(),
            color_code: moduleColor
          })
        }
      );

      if (response.ok) {
        setActionForm({
          title: '',
          description: '',
          action_type: 'REMINDER',
          scheduled_date: '',
          scheduled_time: '',
          location: '',
          invitees: []
        });
        setShowActionForm(false);
        fetchScheduledActions(); // Refresh actions
      }
    } catch (error) {
      console.error('Error creating scheduled action:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeAction = async (actionId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/scheduled-actions/${actionId}/complete`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        fetchScheduledActions(); // Refresh actions
      }
    } catch (error) {
      console.error('Error completing action:', error);
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  if (!activeGroup) {
    return (
      <div className="universal-chat-layout">
        <div className="chat-welcome">
          <div className="welcome-content">
            <Users size={64} color={moduleColor} />
            <h3>Выберите группу для общения</h3>
            <p>Выберите группу из списка слева или создайте новую</p>
            <button 
              className="btn-primary"
              onClick={onCreateGroup}
              style={{ backgroundColor: moduleColor }}
            >
              <Plus size={20} />
              Создать группу
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="universal-chat-layout">
      {/* Main Chat Area (70%) */}
      <div className="chat-main-area">
        {/* Chat Header */}
        <div className="chat-header" style={{ borderBottomColor: moduleColor }}>
          <div className="chat-group-info">
            <div className="group-avatar" style={{ backgroundColor: activeGroup.group.color_code }}>
              <Users size={24} color="white" />
            </div>
            <div className="group-details">
              <h3>{activeGroup.group.name}</h3>
              <p>{activeGroup.member_count} участник(ов) • {activeGroup.group.group_type}</p>
            </div>
          </div>
          <div className="chat-actions">
            <button className="chat-action-btn" title="Участники">
              <UserPlus size={20} />
            </button>
            <button className="chat-action-btn" title="Настройки">
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-messages">
              <div className="empty-content">
                <Users size={48} color="#9ca3af" />
                <h4>Пока нет сообщений</h4>
                <p>Начните беседу, отправив первое сообщение</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.user_id === user.id ? 'own-message' : 'other-message'}`}
              >
                <div className="message-content">
                  <div className="message-header">
                    <span className="sender-name">
                      {message.sender ? `${message.sender.first_name} ${message.sender.last_name}` : 'Unknown'}
                    </span>
                    <span className="message-time">{formatTime(message.created_at)}</span>
                  </div>
                  <div className="message-text">{message.content}</div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form className="message-input-area" onSubmit={sendMessage}>
          <div className="input-wrapper">
            <button type="button" className="attachment-btn" title="Прикрепить файл">
              <Paperclip size={20} />
            </button>
            <button type="button" className="emoji-btn" title="Эмодзи">
              <Smile size={20} />
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Введите сообщение..."
              className="message-input"
              disabled={loading}
            />
            <button 
              type="submit" 
              className="send-btn" 
              disabled={!newMessage.trim() || loading}
              style={{ backgroundColor: moduleColor }}
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>

      {/* Scheduled Actions Panel (30%) */}
      <div className="scheduled-actions-panel">
        <div className="panel-header" style={{ borderBottomColor: moduleColor }}>
          <h4>Запланированные действия</h4>
          <button 
            className="create-action-btn"
            onClick={() => setShowActionForm(!showActionForm)}
            style={{ color: moduleColor }}
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Quick Action Buttons */}
        <div className="quick-actions">
          <button 
            className="quick-action-btn"
            onClick={() => {
              setActionForm({ ...actionForm, action_type: 'REMINDER', title: 'Напоминание' });
              setShowActionForm(true);
            }}
            style={{ borderColor: moduleColor, color: moduleColor }}
          >
            <AlertCircle size={16} />
            <span>Напоминание</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => {
              setActionForm({ ...actionForm, action_type: 'BIRTHDAY', title: 'День рождения' });
              setShowActionForm(true);
            }}
            style={{ borderColor: moduleColor, color: moduleColor }}
          >
            <Calendar size={16} />
            <span>День рождения</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => {
              setActionForm({ ...actionForm, action_type: 'APPOINTMENT', title: 'Встреча' });
              setShowActionForm(true);
            }}
            style={{ borderColor: moduleColor, color: moduleColor }}
          >
            <Clock size={16} />
            <span>Встреча</span>
          </button>
        </div>

        {/* Action Creation Form */}
        {showActionForm && (
          <div className="action-form">
            <form onSubmit={createScheduledAction}>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Название действия"
                  value={actionForm.title}
                  onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <textarea
                  placeholder="Описание (необязательно)"
                  value={actionForm.description}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <input
                    type="date"
                    value={actionForm.scheduled_date}
                    onChange={(e) => setActionForm({ ...actionForm, scheduled_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="time"
                    value={actionForm.scheduled_time}
                    onChange={(e) => setActionForm({ ...actionForm, scheduled_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Место (необязательно)"
                  value={actionForm.location}
                  onChange={(e) => setActionForm({ ...actionForm, location: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowActionForm(false)} className="btn-cancel">
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="btn-create"
                  style={{ backgroundColor: moduleColor }}
                  disabled={loading}
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Scheduled Actions List */}
        <div className="actions-list">
          {scheduledActions.length === 0 ? (
            <div className="empty-actions">
              <Calendar size={32} color="#9ca3af" />
              <p>Нет запланированных действий</p>
            </div>
          ) : (
            scheduledActions.map((action) => (
              <div
                key={action.id}
                className={`action-item ${action.is_completed ? 'completed' : ''}`}
                style={{ borderLeftColor: action.color_code }}
              >
                <div className="action-header">
                  <h5>{action.title}</h5>
                  <button
                    onClick={() => completeAction(action.id)}
                    className={`complete-btn ${action.is_completed ? 'completed' : ''}`}
                    disabled={action.is_completed}
                  >
                    <CheckCircle size={16} />
                  </button>
                </div>
                {action.description && (
                  <p className="action-description">{action.description}</p>
                )}
                <div className="action-details">
                  <div className="detail-item">
                    <Calendar size={14} />
                    <span>{formatDate(action.scheduled_date)}</span>
                  </div>
                  {action.scheduled_time && (
                    <div className="detail-item">
                      <Clock size={14} />
                      <span>{action.scheduled_time}</span>
                    </div>
                  )}
                  {action.location && (
                    <div className="detail-item">
                      <MapPin size={14} />
                      <span>{action.location}</span>
                    </div>
                  )}
                </div>
                <div className="action-type">{action.action_type}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default UniversalChatLayout;