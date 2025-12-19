/**
 * NewsEventsPanel Component
 * Events panel specifically for the NEWS module
 * Shows events from subscribed channels, friends, and personal events
 */
import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Clock, X, Check, Bell, BellOff,
  Film, Video, Mic, Globe, Megaphone, MessageCircle,
  Users, ExternalLink, ChevronRight, Loader2, User
} from 'lucide-react';

// Event type configurations
const EVENT_TYPES = {
  PREMIERE: { icon: Film, label: 'Премьера', color: '#DC2626', emoji: '🎬' },
  STREAM: { icon: Video, label: 'Стрим', color: '#7C3AED', emoji: '📺' },
  BROADCAST: { icon: Mic, label: 'Эфир', color: '#2563EB', emoji: '🎤' },
  ONLINE_EVENT: { icon: Globe, label: 'Онлайн-событие', color: '#059669', emoji: '🎪' },
  ANNOUNCEMENT: { icon: Megaphone, label: 'Анонс', color: '#D97706', emoji: '📢' },
  AMA: { icon: MessageCircle, label: 'AMA/Q&A', color: '#DB2777', emoji: '❓' }
};

const NewsEventsPanel = ({ 
  user,
  moduleColor = "#1D4ED8",
  channelId = null,  // If showing events for a specific channel
  onEventClick = null,
  onNavigateToChannel = null,  // NEW: Callback for channel navigation
  onNavigateToProfile = null   // NEW: Callback for user profile navigation
}) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'ANNOUNCEMENT',
    event_date: '',
    event_time: '',
    duration_minutes: 60,
    event_link: '',
    cover_url: ''
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const url = channelId 
        ? `${BACKEND_URL}/api/news/events?channel_id=${channelId}`
        : `${BACKEND_URL}/api/news/events`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchEvents();
  }, [channelId, BACKEND_URL]);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.event_date) {
      setError('Заполните название и дату события');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      
      // Combine date and time
      const eventDateTime = eventForm.event_time 
        ? `${eventForm.event_date}T${eventForm.event_time}:00`
        : `${eventForm.event_date}T12:00:00`;

      const response = await fetch(`${BACKEND_URL}/api/news/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: eventForm.title,
          description: eventForm.description || null,
          event_type: eventForm.event_type,
          event_date: new Date(eventDateTime).toISOString(),
          duration_minutes: eventForm.duration_minutes || null,
          channel_id: channelId || null,
          event_link: eventForm.event_link || null,
          cover_url: eventForm.cover_url || null
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchEvents();
      } else {
        const data = await response.json();
        setError(data.detail || 'Ошибка создания события');
      }
    } catch (error) {
      setError('Ошибка сети');
    } finally {
      setCreating(false);
    }
  };

  const handleAttend = async (eventId, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/events/${eventId}/attend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(prev => prev.map(event => 
          event.id === eventId 
            ? { 
                ...event, 
                is_attending: data.is_attending,
                attendees_count: data.is_attending 
                  ? event.attendees_count + 1 
                  : event.attendees_count - 1
              }
            : event
        ));
      }
    } catch (error) {
      console.error('Error toggling attendance:', error);
    }
  };

  const handleRemind = async (eventId, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/news/events/${eventId}/remind`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(prev => prev.map(event => 
          event.id === eventId 
            ? { ...event, has_reminder: data.has_reminder }
            : event
        ));
      }
    } catch (error) {
      console.error('Error toggling reminder:', error);
    }
  };

  // NEW: Handle navigation to channel or profile
  const handleNavigate = (event, e) => {
    e.stopPropagation();
    
    if (event.channel && event.channel_id) {
      // Navigate to channel
      if (onNavigateToChannel) {
        onNavigateToChannel(event.channel);
      }
    } else if (event.creator && event.creator_id) {
      // Navigate to user profile
      if (onNavigateToProfile) {
        onNavigateToProfile(event.creator);
      }
    }
  };

  const resetForm = () => {
    setEventForm({
      title: '',
      description: '',
      event_type: 'ANNOUNCEMENT',
      event_date: '',
      event_time: '',
      duration_minutes: 60,
      event_link: '',
      cover_url: ''
    });
    setSelectedEventType(null);
    setError('');
  };

  const formatEventDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    if (date.toDateString() === now.toDateString()) {
      return `Сегодня, ${timeStr}`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Завтра, ${timeStr}`;
    } else {
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const selectEventType = (type) => {
    setSelectedEventType(type);
    setEventForm(prev => ({
      ...prev,
      event_type: type,
      title: prev.title || EVENT_TYPES[type].label
    }));
  };

  // Determine if event is from a channel or a person
  const getEventSource = (event) => {
    if (event.channel && event.channel_id) {
      return { type: 'channel', data: event.channel };
    } else if (event.creator) {
      return { type: 'person', data: event.creator };
    }
    return null;
  };

  return (
    <div className="news-events-panel">
      <div className="news-events-header">
        <h3>
          <Calendar size={18} />
          СОБЫТИЯ
        </h3>
        <button 
          className="create-event-btn-text"
          onClick={() => setShowCreateModal(true)}
          style={{ color: moduleColor }}
        >
          <Plus size={14} />
          СОЗДАТЬ
        </button>
      </div>

      <div className="news-events-list">
        {loading ? (
          <div className="events-loading">
            <Loader2 className="spin" size={24} />
            <span>Загрузка...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="events-empty">
            <Calendar size={32} />
            <p>Нет предстоящих событий</p>
            <button 
              className="create-first-event-btn"
              onClick={() => setShowCreateModal(true)}
              style={{ color: moduleColor }}
            >
              Создать событие
            </button>
          </div>
        ) : (
          <>
            <div className="events-section-label">СКОРО</div>
            {events.map(event => {
              const typeConfig = EVENT_TYPES[event.event_type] || EVENT_TYPES.ANNOUNCEMENT;
              const TypeIcon = typeConfig.icon;
              const source = getEventSource(event);
              
              return (
                <div 
                  key={event.id}
                  className="news-event-card"
                  onClick={() => onEventClick && onEventClick(event)}
                >
                  <div 
                    className="event-type-indicator"
                    style={{ backgroundColor: typeConfig.color }}
                  >
                    <TypeIcon size={14} />
                  </div>
                  
                  <div className="event-content">
                    <div className="event-title">{event.title}</div>
                    
                    {/* Clickable source indicator with avatar */}
                    <div className="event-source-info">
                      {source?.type === 'channel' ? (
                        <button 
                          className="event-source-row clickable"
                          onClick={(e) => handleNavigate(event, e)}
                          title={`Перейти в канал "${source.data.name}"`}
                        >
                          {source.data.avatar_url ? (
                            <img 
                              src={source.data.avatar_url} 
                              alt="" 
                              className="event-source-avatar"
                            />
                          ) : (
                            <div className="event-source-avatar event-source-avatar-placeholder channel">
                              📺
                            </div>
                          )}
                          <span className="event-source-name channel-source">
                            {source.data.name}
                          </span>
                          <ExternalLink size={10} className="source-link-icon" />
                        </button>
                      ) : source?.type === 'person' ? (
                        <button 
                          className="event-source-row clickable"
                          onClick={(e) => handleNavigate(event, e)}
                          title={`Перейти в профиль ${source.data.first_name}`}
                        >
                          {source.data.profile_picture ? (
                            <img 
                              src={source.data.profile_picture} 
                              alt="" 
                              className="event-source-avatar"
                            />
                          ) : (
                            <div className="event-source-avatar event-source-avatar-placeholder person">
                              <User size={12} />
                            </div>
                          )}
                          <span className="event-source-name person-source">
                            {source.data.first_name} {source.data.last_name}
                          </span>
                          <ExternalLink size={10} className="source-link-icon" />
                        </button>
                      ) : null}
                    </div>
                    
                    <div className="event-time">
                      <Clock size={12} />
                      {formatEventDate(event.event_date)}
                    </div>
                    
                    {event.attendees_count > 0 && (
                      <div className="event-attendees">
                        <Users size={12} />
                        <span>{event.attendees_count} участников</span>
                      </div>
                    )}
                    
                  </div>
                  
                  <div className="event-actions">
                    <button
                      className={`attend-btn ${event.is_attending ? 'active' : ''}`}
                      onClick={(e) => handleAttend(event.id, e)}
                      title={event.is_attending ? 'Отменить участие' : 'Буду участвовать'}
                      style={event.is_attending ? { backgroundColor: moduleColor, color: 'white' } : {}}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className={`remind-btn ${event.has_reminder ? 'active' : ''}`}
                      onClick={(e) => handleRemind(event.id, e)}
                      title={event.has_reminder ? 'Отменить напоминание' : 'Напомнить'}
                      style={event.has_reminder ? { backgroundColor: moduleColor, color: 'white' } : {}}
                    >
                      {event.has_reminder ? <Bell size={14} /> : <BellOff size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); resetForm(); }}>
          <div className="modal-content news-event-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Plus size={20} />
                Создать событие
              </h2>
              <button className="close-btn" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              {/* Event Type Selection */}
              {!selectedEventType ? (
                <div className="event-type-selection">
                  <label>Выберите тип события</label>
                  <div className="event-types-grid">
                    {Object.entries(EVENT_TYPES).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={key}
                          className="event-type-btn"
                          onClick={() => selectEventType(key)}
                          style={{ '--type-color': config.color }}
                        >
                          <span className="type-emoji">{config.emoji}</span>
                          <Icon size={20} />
                          <span className="type-label">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateEvent} className="event-form">
                  {/* Selected Type Badge */}
                  <div className="selected-type-badge" style={{ backgroundColor: EVENT_TYPES[selectedEventType].color }}>
                    {EVENT_TYPES[selectedEventType].emoji} {EVENT_TYPES[selectedEventType].label}
                    <button type="button" onClick={() => setSelectedEventType(null)}>
                      <X size={14} />
                    </button>
                  </div>

                  <div className="form-group">
                    <label>Название *</label>
                    <input
                      type="text"
                      value={eventForm.title}
                      onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Название события"
                      maxLength={100}
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label>Описание</label>
                    <textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="О чём это событие?"
                      rows={3}
                      maxLength={500}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Дата *</label>
                      <input
                        type="date"
                        value={eventForm.event_date}
                        onChange={(e) => setEventForm(prev => ({ ...prev, event_date: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="form-group">
                      <label>Время</label>
                      <input
                        type="time"
                        value={eventForm.event_time}
                        onChange={(e) => setEventForm(prev => ({ ...prev, event_time: e.target.value }))}
                      />
                    </div>
                  </div>

                  {(selectedEventType === 'STREAM' || selectedEventType === 'ONLINE_EVENT' || selectedEventType === 'BROADCAST') && (
                    <div className="form-group">
                      <label>
                        <ExternalLink size={14} />
                        Ссылка на событие
                      </label>
                      <input
                        type="url"
                        value={eventForm.event_link}
                        onChange={(e) => setEventForm(prev => ({ ...prev, event_link: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Длительность (минуты)</label>
                    <select
                      value={eventForm.duration_minutes}
                      onChange={(e) => setEventForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                    >
                      <option value={30}>30 минут</option>
                      <option value={60}>1 час</option>
                      <option value={90}>1.5 часа</option>
                      <option value={120}>2 часа</option>
                      <option value={180}>3 часа</option>
                      <option value={0}>Без ограничения</option>
                    </select>
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="cancel-btn"
                      onClick={() => { setShowCreateModal(false); resetForm(); }}
                    >
                      Отмена
                    </button>
                    <button 
                      type="submit" 
                      className="submit-btn"
                      disabled={creating}
                      style={{ backgroundColor: moduleColor }}
                    >
                      {creating ? 'Создание...' : 'Создать'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsEventsPanel;
