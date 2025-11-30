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
    <div className="universal-events-panel family-events-redesign">
      {/* Tabs - Скоро / Все события */}
      <div className="events-tabs">
        <button 
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
          style={{ 
            backgroundColor: activeTab === 'upcoming' ? moduleColor : 'transparent',
            color: activeTab === 'upcoming' ? 'white' : moduleColor
          }}
        >
          Скоро
        </button>
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          style={{ 
            backgroundColor: activeTab === 'all' ? moduleColor : 'transparent',
            color: activeTab === 'all' ? 'white' : moduleColor
          }}
        >
          Все события
        </button>
        <button 
          className="create-event-btn"
          onClick={() => setShowActionForm(!showActionForm)}
          style={{ backgroundColor: moduleColor }}
        >
          <Plus size={16} />
          Создать событие
        </button>
      </div>

      {/* Action Creation Form */}
      {showActionForm && (
        <div className="action-form-card">
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
                disabled={loading}
                style={{ backgroundColor: '#4CAF50' }}
              >
                {loading ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Event Cards List */}
      <div className="events-card-list">
        {scheduledActions.length === 0 ? (
          <div className="empty-events-state">
            <Calendar size={48} color="#A5D6A7" />
            <p>Нет запланированных событий</p>
            <small>Создайте первое событие для вашей семьи</small>
          </div>
        ) : (
          scheduledActions
            .filter(action => {
              if (activeTab === 'upcoming') {
                const eventDate = new Date(action.scheduled_date);
                const now = new Date();
                return eventDate >= now && !action.is_completed;
              }
              return true;
            })
            .map((action) => (
              <div
                key={action.id}
                className={`event-card ${action.is_completed ? 'completed' : ''}`}
              >
                {/* Event Image/Icon Header */}
                <div className="event-card-header" style={{ background: `linear-gradient(135deg, ${moduleColor} 0%, #4CAF50 100%)` }}>
                  <div className="event-icon-large">
                    {getActionIcon(action.action_type)}
                  </div>
                </div>

                {/* Event Content */}
                <div className="event-card-content">
                  <div className="event-time">
                    <Clock size={14} />
                    <span>{formatTimeAgo(action.scheduled_date)}</span>
                  </div>
                  
                  <h3 className="event-title">{action.title}</h3>
                  
                  {action.description && (
                    <p className="event-description">{action.description}</p>
                  )}

                  <div className="event-meta-info">
                    {action.scheduled_time && (
                      <div className="meta-item">
                        <Clock size={14} />
                        <span>{action.scheduled_time}</span>
                      </div>
                    )}
                    {action.location && (
                      <div className="meta-item">
                        <MapPin size={14} />
                        <span>{action.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Interaction Buttons */}
                  <div className="event-actions">
                    <button className="event-action-btn">
                      <ThumbsUp size={16} />
                      <span>46</span>
                    </button>
                    <button className="event-action-btn">
                      <MessageCircle size={16} />
                      <span>12</span>
                    </button>
                    <button className="event-action-btn">
                      <Share2 size={16} />
                      <span>Поделиться</span>
                    </button>
                    {!action.is_completed && (
                      <button
                        onClick={() => completeAction(action.id)}
                        className="join-event-btn"
                        style={{ backgroundColor: '#4CAF50' }}
                      >
                        Присоединиться
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

export default UniversalEventsPanel;