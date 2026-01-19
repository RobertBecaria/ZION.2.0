import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Clock, MapPin, Check, HelpCircle, X,
  Gift, Users, FileText, ChevronRight, Timer, Cake,
  GraduationCap, Bus, Trophy, Bell, Edit3
} from 'lucide-react';

// Quick create presets
const QUICK_PRESETS = [
  { type: 'BIRTHDAY', label: 'День рождения', icon: '🎂', color: '#EAB308' },
  { type: 'MEETING', label: 'Собрание', icon: '👥', color: '#3B82F6' },
  { type: 'CUSTOM', label: 'Своё событие', icon: '📝', color: '#6B7280' }
];

// Event type configurations with role colors
const EVENT_CONFIG = {
  HOLIDAY: { icon: '🎉', label: 'Праздник' },
  EXAM: { icon: '📝', label: 'Экзамен' },
  MEETING: { icon: '👥', label: 'Собрание' },
  EVENT: { icon: '🎭', label: 'Мероприятие' },
  DEADLINE: { icon: '⏰', label: 'Дедлайн' },
  VACATION: { icon: '🏖️', label: 'Каникулы' },
  CONFERENCE: { icon: '🎤', label: 'Конференция' },
  COMPETITION: { icon: '🏆', label: 'Соревнование' },
  BIRTHDAY: { icon: '🎂', label: 'День рождения' },
  EXCURSION: { icon: '🚌', label: 'Экскурсия' },
  REMINDER: { icon: '🔔', label: 'Напоминание' },
  APPOINTMENT: { icon: '📅', label: 'Встреча' }
};

// Role colors for event creators
const ROLE_COLORS = {
  ADMIN: '#DC2626',    // Red
  TEACHER: '#2563EB',  // Blue
  PARENT: '#16A34A',   // Green
  STUDENT: '#EAB308'   // Yellow
};

function UniversalEventsPanel({ 
  activeGroup, 
  moduleColor = "#30A67E",
  moduleName = "Family",
  user,
  context = "wall",
  onOpenFullCalendar = null
}) {
  const [events, setEvents] = useState([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  // Form state
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'EVENT',
    scheduled_date: '',
    scheduled_time: '',
    location: '',
    requires_rsvp: false
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (activeGroup) {
      fetchEvents();
    }
  }, [activeGroup]);

  const fetchEvents = async () => {
    if (!activeGroup) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/chat-groups/${activeGroup.group.id}/scheduled-actions`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data.scheduled_actions || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreate = (preset) => {
    setSelectedPreset(preset);
    setEventForm(prev => ({
      ...prev,
      event_type: preset.type,
      title: preset.type === 'CUSTOM' ? '' : preset.label,
      requires_rsvp: preset.type === 'MEETING' || preset.type === 'BIRTHDAY'
    }));
    setShowQuickCreate(false);
    setShowCreateForm(true);
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !activeGroup || createLoading) return;

    setCreateLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/chat-groups/${activeGroup.group.id}/scheduled-actions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...eventForm,
            scheduled_date: new Date(eventForm.scheduled_date).toISOString(),
            color_code: moduleColor,
            action_type: eventForm.event_type
          })
        }
      );

      if (response.ok) {
        resetForm();
        fetchEvents();
      }
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRSVP = async (eventId, status) => {
    // TODO: Connect to RSVP endpoint
  };

  const resetForm = () => {
    setEventForm({
      title: '',
      description: '',
      event_type: 'EVENT',
      scheduled_date: '',
      scheduled_time: '',
      location: '',
      requires_rsvp: false
    });
    setShowCreateForm(false);
    setSelectedPreset(null);
  };

  // Calculate countdown
  const getCountdown = (dateString, timeString) => {
    const eventDate = new Date(dateString);
    if (timeString) {
      const [hours, minutes] = timeString.split(':');
      eventDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    const now = new Date();
    const diff = eventDate - now;
    
    if (diff <= 0) return { text: 'Прошло', days: -1, expired: true };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days === 0) {
      if (hours === 0) return { text: 'Скоро', days: 0, hours: 0 };
      return { text: `${hours} ч`, days: 0, hours };
    }
    if (days === 1) return { text: 'Завтра', days: 1 };
    
    // Russian pluralization for days
    let dayWord = 'дней';
    if (days % 10 === 1 && days % 100 !== 11) dayWord = 'день';
    else if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) dayWord = 'дня';
    
    return { text: `${days} ${dayWord}`, days };
  };

  const formatEventTime = (dateString, timeString) => {
    const date = new Date(dateString);
    const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const day = dayNames[date.getDay()];
    const time = timeString || '';
    return `${day}${time ? ', ' + time : ''}`;
  };

  const getEventConfig = (type) => {
    return EVENT_CONFIG[type] || EVENT_CONFIG.EVENT;
  };

  const getRoleColor = (role) => {
    return ROLE_COLORS[role] || ROLE_COLORS.PARENT;
  };

  // Filter and sort upcoming events
  const upcomingEvents = events
    .filter(event => {
      const countdown = getCountdown(event.scheduled_date, event.scheduled_time);
      return !countdown.expired && !event.is_completed;
    })
    .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
    .slice(0, 5);

  return (
    <div className="events-panel-redesign" style={{ '--module-color': moduleColor }}>
      {/* Header */}
      <div className="ep-header">
        <div className="ep-title">
          <Calendar size={18} style={{ color: moduleColor }} />
          <span>СОБЫТИЯ</span>
        </div>
      </div>

      {/* Quick Create Section */}
      <div className="ep-quick-create">
        <button 
          className="ep-quick-toggle"
          onClick={() => setShowQuickCreate(!showQuickCreate)}
          style={{ 
            borderColor: showQuickCreate ? moduleColor : '#E5E7EB',
            color: showQuickCreate ? moduleColor : '#374151'
          }}
        >
          <Plus size={16} />
          <span>Быстрое создание</span>
        </button>
        
        {showQuickCreate && (
          <div className="ep-presets">
            {QUICK_PRESETS.map(preset => (
              <button
                key={preset.type}
                className="ep-preset-btn"
                onClick={() => handleQuickCreate(preset)}
              >
                <span className="preset-icon">{preset.icon}</span>
                <span className="preset-label">{preset.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Form (Inline) */}
      {showCreateForm && (
        <div className="ep-create-form">
          <div className="form-header">
            <span>{selectedPreset?.icon} {selectedPreset?.type === 'CUSTOM' ? 'Новое событие' : selectedPreset?.label}</span>
            <button className="close-btn" onClick={resetForm}>
              <X size={16} />
            </button>
          </div>
          
          <form onSubmit={handleCreateEvent}>
            <input
              type="text"
              placeholder="Название"
              value={eventForm.title}
              onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
              required
              autoFocus
            />
            
            <div className="form-row">
              <input
                type="date"
                value={eventForm.scheduled_date}
                onChange={(e) => setEventForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                required
              />
              <input
                type="time"
                value={eventForm.scheduled_time}
                onChange={(e) => setEventForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
              />
            </div>
            
            <input
              type="text"
              placeholder="Место (необязательно)"
              value={eventForm.location}
              onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
            />
            
            {(selectedPreset?.type === 'MEETING' || selectedPreset?.type === 'BIRTHDAY') && (
              <label className="rsvp-toggle">
                <input
                  type="checkbox"
                  checked={eventForm.requires_rsvp}
                  onChange={(e) => setEventForm(prev => ({ ...prev, requires_rsvp: e.target.checked }))}
                />
                <span>Требуется подтверждение</span>
              </label>
            )}
            
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={resetForm}>
                Отмена
              </button>
              <button 
                type="submit" 
                className="btn-create"
                disabled={createLoading}
                style={{ backgroundColor: moduleColor }}
              >
                {createLoading ? '...' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming Events Section */}
      <div className="ep-section">
        <div className="ep-section-header">
          <Timer size={14} />
          <span>СКОРО</span>
        </div>
        
        <div className="ep-events-list">
          {loading ? (
            <div className="ep-loading">Загрузка...</div>
          ) : upcomingEvents.length === 0 ? (
            <div className="ep-empty">
              <Calendar size={32} style={{ color: `${moduleColor}50` }} />
              <p>Нет предстоящих событий</p>
              <small>Создайте первое событие</small>
            </div>
          ) : (
            upcomingEvents.map(event => {
              const config = getEventConfig(event.action_type || event.event_type);
              const countdown = getCountdown(event.scheduled_date, event.scheduled_time);
              const roleColor = event.role_color || getRoleColor(event.creator_role);
              const hasRSVP = event.requires_rsvp;
              const rsvpSummary = event.rsvp_summary || { YES: 0, MAYBE: 0, NO: 0 };
              
              return (
                <div 
                  key={event.id} 
                  className="ep-event-card"
                  style={{ '--role-color': roleColor }}
                >
                  {/* Countdown Badge */}
                  <div className="event-countdown">
                    <span className="countdown-text">{countdown.text}</span>
                  </div>
                  
                  {/* Event Content */}
                  <div className="event-content">
                    <div className="event-header">
                      <span 
                        className="event-role-dot" 
                        style={{ backgroundColor: roleColor }}
                        title={event.creator_role || 'Организатор'}
                      />
                      <span className="event-icon">{config.icon}</span>
                      <h4 className="event-title">{event.title}</h4>
                    </div>
                    
                    <div className="event-meta">
                      <span className="meta-time">
                        {formatEventTime(event.scheduled_date, event.scheduled_time)}
                      </span>
                      {event.location && (
                        <span className="meta-location">
                          <MapPin size={12} />
                          {event.location}
                        </span>
                      )}
                    </div>
                    
                    {/* RSVP Section */}
                    {hasRSVP && (
                      <div className="event-rsvp">
                        <button 
                          className={`rsvp-btn yes ${event.user_rsvp === 'YES' ? 'active' : ''}`}
                          onClick={() => handleRSVP(event.id, 'YES')}
                        >
                          <Check size={14} />
                          <span>Да</span>
                          {rsvpSummary.YES > 0 && <span className="count">{rsvpSummary.YES}</span>}
                        </button>
                        <button 
                          className={`rsvp-btn maybe ${event.user_rsvp === 'MAYBE' ? 'active' : ''}`}
                          onClick={() => handleRSVP(event.id, 'MAYBE')}
                        >
                          <HelpCircle size={14} />
                          {rsvpSummary.MAYBE > 0 && <span className="count">{rsvpSummary.MAYBE}</span>}
                        </button>
                        <button 
                          className={`rsvp-btn no ${event.user_rsvp === 'NO' ? 'active' : ''}`}
                          onClick={() => handleRSVP(event.id, 'NO')}
                        >
                          <X size={14} />
                          {rsvpSummary.NO > 0 && <span className="count">{rsvpSummary.NO}</span>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Open Full Calendar Button */}
      {onOpenFullCalendar && (
        <button 
          className="ep-open-calendar"
          onClick={onOpenFullCalendar}
          style={{ color: moduleColor }}
        >
          <Calendar size={16} />
          <span>Открыть полный календарь</span>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

export default UniversalEventsPanel;
