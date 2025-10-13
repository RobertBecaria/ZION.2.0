import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Clock, Users, Settings, 
  AlertCircle, MapPin, CheckCircle, UserPlus, Heart,
  MessageCircle, Share2, ThumbsUp
} from 'lucide-react';

function UniversalEventsPanel({ 
  activeGroup, 
  moduleColor = "#30A67E", // Updated to match Family design
  moduleName = "Family",
  user,
  context = "wall" // "wall" or "chat"
}) {
  const [scheduledActions, setScheduledActions] = useState([]);
  const [showActionForm, setShowActionForm] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'all'
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

  useEffect(() => {
    if (activeGroup) {
      fetchScheduledActions();
    }
  }, [activeGroup]);

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTimeAgo = (dateString) => {
    const eventDate = new Date(dateString);
    const now = new Date();
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Завтра';
    if (diffDays > 1) return `Через ${diffDays} дней`;
    if (diffDays === -1) return 'Вчера';
    if (diffDays < -1) return `${Math.abs(diffDays)} дней назад`;
    
    return formatDate(dateString);
  };

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'REMINDER':
        return <AlertCircle size={16} />;
      case 'BIRTHDAY':
        return <Heart size={16} />;
      case 'APPOINTMENT':
        return <Clock size={16} />;
      case 'EVENT':
        return <Calendar size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getContextTitle = () => {
    switch (context) {
      case 'wall':
        return 'События стены';
      case 'chat':
        return 'События чата';
      default:
        return 'События';
    }
  };

  const getQuickActions = () => {
    const baseActions = [
      { type: 'REMINDER', title: 'Напоминание', icon: AlertCircle },
      { type: 'APPOINTMENT', title: 'Встреча', icon: Clock },
      { type: 'EVENT', title: 'Событие', icon: Calendar }
    ];

    if (moduleName.toLowerCase() === 'family') {
      baseActions.splice(1, 0, { type: 'BIRTHDAY', title: 'День рождения', icon: Heart });
    }

    return baseActions;
  };

  return (
    <div className="universal-events-panel">
      <div className="panel-header" style={{ borderBottomColor: moduleColor }}>
        <h4>{getContextTitle()}</h4>
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
        {getQuickActions().map((action) => {
          const IconComponent = action.icon;
          return (
            <button 
              key={action.type}
              className="quick-action-btn"
              onClick={() => {
                setActionForm({ ...actionForm, action_type: action.type, title: action.title });
                setShowActionForm(true);
              }}
              style={{ borderColor: moduleColor, color: moduleColor }}
            >
              <IconComponent size={16} />
              <span>{action.title}</span>
            </button>
          );
        })}
      </div>

      {/* Action Creation Form */}
      {showActionForm && (
        <div className="action-form">
          <form onSubmit={createScheduledAction}>
            <div className="form-group">
              <input
                type="text"
                placeholder="Название события"
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
            <p>Нет запланированных событий</p>
            <small>Создайте первое событие</small>
          </div>
        ) : (
          scheduledActions.map((action) => (
            <div
              key={action.id}
              className={`action-item ${action.is_completed ? 'completed' : ''}`}
              style={{ borderLeftColor: action.color_code || moduleColor }}
            >
              <div className="action-header">
                <div className="action-icon" style={{ color: action.color_code || moduleColor }}>
                  {getActionIcon(action.action_type)}
                </div>
                <div className="action-details">
                  <h5>{action.title}</h5>
                  <div className="action-meta">
                    <div className="detail-item">
                      <Calendar size={12} />
                      <span>{formatDate(action.scheduled_date)}</span>
                    </div>
                    {action.scheduled_time && (
                      <div className="detail-item">
                        <Clock size={12} />
                        <span>{action.scheduled_time}</span>
                      </div>
                    )}
                    {action.location && (
                      <div className="detail-item">
                        <MapPin size={12} />
                        <span>{action.location}</span>
                      </div>
                    )}
                  </div>
                </div>
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
              <div className="action-type">{action.action_type}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default UniversalEventsPanel;