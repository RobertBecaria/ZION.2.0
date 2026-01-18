import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, X, Check, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

import { BACKEND_URL } from '../config/api';
const API = `${BACKEND_URL}/api`;

const EVENT_TYPES = [
  { value: 'MEETING', label: 'Встреча', icon: '👥' },
  { value: 'TRAINING', label: 'Обучение', icon: '📚' },
  { value: 'DEADLINE', label: 'Дедлайн', icon: '⏰' },
  { value: 'COMPANY_EVENT', label: 'Мероприятие', icon: '🎉' },
  { value: 'TEAM_BUILDING', label: 'Тимбилдинг', icon: '🤝' },
  { value: 'REVIEW', label: 'Ревью', icon: '📝' },
  { value: 'ANNOUNCEMENT', label: 'Объявление', icon: '📢' },
  { value: 'OTHER', label: 'Другое', icon: '📌' }
];

const VISIBILITY_OPTIONS = [
  { value: 'ALL_MEMBERS', label: 'Все сотрудники' },
  { value: 'DEPARTMENT', label: 'Только отдел' },
  { value: 'TEAM', label: 'Только команда' },
  { value: 'ADMINS_ONLY', label: 'Только админы' }
];

function WorkEventsPanel({ organizationId, currentMembership }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' or 'all'
  const [expandedEventId, setExpandedEventId] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'OTHER',
    scheduled_date: '',
    scheduled_time: '',
    end_time: '',
    location: '',
    visibility: 'ALL_MEMBERS',
    rsvp_enabled: true,
    reminder_intervals: []  // Array of selected reminders
  });

  useEffect(() => {
    if (organizationId) {
      fetchEvents();
    }
  }, [organizationId, filter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const upcoming = filter === 'upcoming' ? 'true' : 'false';
      const response = await fetch(`${API}/work/organizations/${organizationId}/events?upcoming_only=${upcoming}`, {
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

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.scheduled_date) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${API}/work/organizations/${organizationId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowCreateForm(false);
        setFormData({
          title: '',
          description: '',
          event_type: 'OTHER',
          scheduled_date: '',
          scheduled_time: '',
          end_time: '',
          location: '',
          visibility: 'ALL_MEMBERS',
          rsvp_enabled: true,
          reminder_intervals: []
        });
        fetchEvents();
      }
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (eventId, response) => {
    try {
      const token = localStorage.getItem('zion_token');
      const res = await fetch(`${API}/work/organizations/${organizationId}/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ response })
      });

      if (res.ok) {
        fetchEvents();
      }
    } catch (error) {
      console.error('Error RSVPing to event:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Завтра';
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getEventTypeInfo = (type) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
  };

  return (
    <div className="work-events-panel">
      {/* Header */}
      <div className="events-panel-header">
        <h3 className="events-panel-title">
          <Calendar className="inline-block mr-2" size={20} />
          События
        </h3>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="create-event-btn"
          size="sm"
        >
          {showCreateForm ? <X size={16} /> : <Plus size={16} />}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="events-filter-tabs">
        <button
          className={`filter-tab ${filter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          Предстоящие
        </button>
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Все события
        </button>
      </div>

      {/* Create Event Form */}
      {showCreateForm && (
        <div className="event-create-form">
          <form onSubmit={handleCreateEvent}>
            <div className="form-group">
              <input
                type="text"
                placeholder="Название события"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <textarea
                placeholder="Описание (необязательно)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="form-row">
              <select
                value={formData.event_type}
                onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                className="form-select"
              >
                {EVENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>

              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                className="form-select"
              >
                {VISIBILITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="form-input"
                required
              />
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <input
                type="text"
                placeholder="Место (необязательно)"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-checkbox">
              <input
                type="checkbox"
                id="rsvp-enabled"
                checked={formData.rsvp_enabled}
                onChange={(e) => setFormData({ ...formData, rsvp_enabled: e.target.checked })}
              />
              <label htmlFor="rsvp-enabled">Включить подтверждение участия (RSVP)</label>
            </div>

            {/* Reminder Options */}
            <div className="reminder-options">
              <label className="reminder-label">Напомнить участникам:</label>
              <div className="reminder-checkboxes">
                <div className="form-checkbox">
                  <input
                    type="checkbox"
                    id="reminder-15min"
                    checked={formData.reminder_intervals.includes('15_MINUTES')}
                    onChange={(e) => {
                      const intervals = [...formData.reminder_intervals];
                      if (e.target.checked) {
                        intervals.push('15_MINUTES');
                      } else {
                        const index = intervals.indexOf('15_MINUTES');
                        if (index > -1) intervals.splice(index, 1);
                      }
                      setFormData({ ...formData, reminder_intervals: intervals });
                    }}
                  />
                  <label htmlFor="reminder-15min">За 15 минут</label>
                </div>
                
                <div className="form-checkbox">
                  <input
                    type="checkbox"
                    id="reminder-1hour"
                    checked={formData.reminder_intervals.includes('1_HOUR')}
                    onChange={(e) => {
                      const intervals = [...formData.reminder_intervals];
                      if (e.target.checked) {
                        intervals.push('1_HOUR');
                      } else {
                        const index = intervals.indexOf('1_HOUR');
                        if (index > -1) intervals.splice(index, 1);
                      }
                      setFormData({ ...formData, reminder_intervals: intervals });
                    }}
                  />
                  <label htmlFor="reminder-1hour">За 1 час</label>
                </div>
                
                <div className="form-checkbox">
                  <input
                    type="checkbox"
                    id="reminder-1day"
                    checked={formData.reminder_intervals.includes('1_DAY')}
                    onChange={(e) => {
                      const intervals = [...formData.reminder_intervals];
                      if (e.target.checked) {
                        intervals.push('1_DAY');
                      } else {
                        const index = intervals.indexOf('1_DAY');
                        if (index > -1) intervals.splice(index, 1);
                      }
                      setFormData({ ...formData, reminder_intervals: intervals });
                    }}
                  />
                  <label htmlFor="reminder-1day">За 1 день</label>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading} className="submit-btn">
                Создать событие
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Events List */}
      <ScrollArea className="events-list">
        {loading && events.length === 0 ? (
          <div className="events-empty">Загрузка...</div>
        ) : events.length === 0 ? (
          <div className="events-empty">
            <Calendar size={48} className="empty-icon" />
            <p>Нет запланированных событий</p>
            <p className="empty-hint">Создайте первое событие для вашей команды!</p>
          </div>
        ) : (
          events.map(event => {
            const typeInfo = getEventTypeInfo(event.event_type);
            const isExpanded = expandedEventId === event.id;
            const totalRSVP = (event.rsvp_summary?.GOING || 0) + (event.rsvp_summary?.MAYBE || 0) + (event.rsvp_summary?.NOT_GOING || 0);

            return (
              <div key={event.id} className="event-card">
                <div className="event-card-header" onClick={() => setExpandedEventId(isExpanded ? null : event.id)}>
                  <div className="event-type-badge">
                    <span className="event-type-icon">{typeInfo.icon}</span>
                  </div>
                  <div className="event-info">
                    <h4 className="event-title">{event.title}</h4>
                    <div className="event-meta">
                      <span className="event-date">
                        <Calendar size={14} />
                        {formatDate(event.scheduled_date)}
                        {event.scheduled_time && ` в ${event.scheduled_time}`}
                      </span>
                      {event.location && (
                        <span className="event-location">
                          <MapPin size={14} />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {event.rsvp_enabled && totalRSVP > 0 && (
                    <Badge className="rsvp-count-badge">
                      <Users size={12} className="mr-1" />
                      {totalRSVP}
                    </Badge>
                  )}
                </div>

                {isExpanded && (
                  <div className="event-card-body">
                    {event.description && (
                      <p className="event-description">{event.description}</p>
                    )}

                    <div className="event-details">
                      <div className="detail-item">
                        <span className="detail-label">Тип:</span>
                        <span className="detail-value">{typeInfo.label}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Создатель:</span>
                        <span className="detail-value">{event.created_by_name}</span>
                      </div>
                      {event.department_name && (
                        <div className="detail-item">
                          <span className="detail-label">Отдел:</span>
                          <span className="detail-value">{event.department_name}</span>
                        </div>
                      )}
                      {event.team_name && (
                        <div className="detail-item">
                          <span className="detail-label">Команда:</span>
                          <span className="detail-value">{event.team_name}</span>
                        </div>
                      )}
                    </div>

                    {/* RSVP Section */}
                    {event.rsvp_enabled && (
                      <div className="event-rsvp-section">
                        <h5 className="rsvp-title">Подтверждение участия</h5>
                        <div className="rsvp-buttons">
                          <button
                            className={`rsvp-btn going ${event.user_rsvp_status === 'GOING' ? 'active' : ''}`}
                            onClick={() => handleRSVP(event.id, 'GOING')}
                          >
                            <Check size={16} />
                            Приду ({event.rsvp_summary?.GOING || 0})
                          </button>
                          <button
                            className={`rsvp-btn maybe ${event.user_rsvp_status === 'MAYBE' ? 'active' : ''}`}
                            onClick={() => handleRSVP(event.id, 'MAYBE')}
                          >
                            <AlertCircle size={16} />
                            Возможно ({event.rsvp_summary?.MAYBE || 0})
                          </button>
                          <button
                            className={`rsvp-btn not-going ${event.user_rsvp_status === 'NOT_GOING' ? 'active' : ''}`}
                            onClick={() => handleRSVP(event.id, 'NOT_GOING')}
                          >
                            <X size={16} />
                            Не приду ({event.rsvp_summary?.NOT_GOING || 0})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}

export default WorkEventsPanel;