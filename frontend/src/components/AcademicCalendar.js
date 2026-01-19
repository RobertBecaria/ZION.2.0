/**
 * AcademicCalendar Component
 * Calendar view for school events, holidays, and important dates
 */
import React, { useState, useEffect } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, MapPin,
  Users
} from 'lucide-react';
import { toast } from '../utils/animations';

const EVENT_TYPES = [
  { value: 'HOLIDAY', label: 'Праздник', icon: '🎉', color: '#10B981' },
  { value: 'EXAM', label: 'Экзамен', icon: '📝', color: '#EF4444' },
  { value: 'MEETING', label: 'Собрание', icon: '👥', color: '#3B82F6' },
  { value: 'EVENT', label: 'Мероприятие', icon: '🎭', color: '#8B5CF6' },
  { value: 'DEADLINE', label: 'Дедлайн', icon: '⏰', color: '#F59E0B' },
  { value: 'VACATION', label: 'Каникулы', icon: '🏖️', color: '#06B6D4' },
  { value: 'CONFERENCE', label: 'Конференция', icon: '🎤', color: '#EC4899' },
  { value: 'COMPETITION', label: 'Соревнование', icon: '🏆', color: '#F97316' }
];

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const AcademicCalendar = ({ organizationId, schoolRoles, user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'list'
  
  // Form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_type: 'EVENT',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    location: '',
    is_all_day: true,
    audience_type: 'PUBLIC'
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const moduleColor = '#6D28D9';

  // Check if user is a teacher (can create events)
  const isTeacher = schoolRoles?.is_teacher && 
    schoolRoles?.schools_as_teacher?.some(s => s.organization_id === organizationId);

  const fetchEvents = async () => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      
      const response = await fetch(
        `${BACKEND_URL}/api/journal/organizations/${organizationId}/calendar?month=${month}&year=${year}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, currentDate]);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.start_date) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/journal/organizations/${organizationId}/calendar`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newEvent)
        }
      );

      if (response.ok) {
        setShowCreateModal(false);
        setNewEvent({
          title: '',
          description: '',
          event_type: 'EVENT',
          start_date: '',
          end_date: '',
          start_time: '',
          end_time: '',
          location: '',
          is_all_day: true,
          audience_type: 'PUBLIC'
        });
        fetchEvents();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Ошибка при создании события');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Ошибка при создании события');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Удалить это событие?')) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/journal/calendar/${eventId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        setSelectedEvent(null);
        fetchEvents();
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    
    const days = [];
    
    // Add empty slots for days before the first day of month
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, date: null });
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, date: dateStr });
    }
    
    return days;
  };

  const getEventsForDate = (dateStr) => {
    return events.filter(event => {
      if (event.start_date === dateStr) return true;
      if (event.end_date && event.start_date <= dateStr && event.end_date >= dateStr) return true;
      return false;
    });
  };

  const getEventTypeInfo = (type) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[3];
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="academic-calendar">
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="calendar-title">
          <Calendar size={24} style={{ color: moduleColor }} />
          <h2>Академический Календарь</h2>
        </div>
        
        <div className="calendar-controls">
          {/* View Mode Toggle */}
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
              style={{ backgroundColor: viewMode === 'month' ? moduleColor : undefined }}
            >
              Месяц
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ backgroundColor: viewMode === 'list' ? moduleColor : undefined }}
            >
              Список
            </button>
          </div>
          
          {/* Month Navigation */}
          <div className="month-nav">
            <button className="nav-btn" onClick={() => navigateMonth(-1)}>
              <ChevronLeft size={20} />
            </button>
            <span className="month-year">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button className="nav-btn" onClick={() => navigateMonth(1)}>
              <ChevronRight size={20} />
            </button>
          </div>
          
          {/* Create Event Button (Teachers only) */}
          {isTeacher && (
            <button 
              className="create-event-btn"
              onClick={() => {
                setNewEvent(prev => ({
                  ...prev,
                  start_date: selectedDate || today
                }));
                setShowCreateModal(true);
              }}
              style={{ backgroundColor: moduleColor }}
            >
              <Plus size={18} />
              <span>Добавить событие</span>
            </button>
          )}
        </div>
      </div>

      {/* Calendar Content */}
      {viewMode === 'month' ? (
        <div className="calendar-month-view">
          {/* Days of week header */}
          <div className="calendar-weekdays">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="weekday">{day}</div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="calendar-grid">
            {days.map((dayInfo, index) => {
              const dayEvents = dayInfo.date ? getEventsForDate(dayInfo.date) : [];
              const isToday = dayInfo.date === today;
              const isSelected = dayInfo.date === selectedDate;
              
              return (
                <div 
                  key={index}
                  className={`calendar-day ${!dayInfo.day ? 'empty' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => dayInfo.date && setSelectedDate(dayInfo.date)}
                  style={{
                    borderColor: isSelected ? moduleColor : undefined,
                    backgroundColor: isSelected ? `${moduleColor}10` : undefined
                  }}
                >
                  {dayInfo.day && (
                    <>
                      <span className="day-number" style={{ color: isToday ? moduleColor : undefined }}>
                        {dayInfo.day}
                      </span>
                      <div className="day-events">
                        {dayEvents.slice(0, 3).map(event => {
                          const typeInfo = getEventTypeInfo(event.event_type);
                          return (
                            <div 
                              key={event.id}
                              className="event-dot"
                              style={{ backgroundColor: event.color || typeInfo.color }}
                              title={event.title}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(event);
                              }}
                            >
                              <span className="event-icon">{typeInfo.icon}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="more-events">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="calendar-list-view">
          {loading ? (
            <div className="loading-state">Загрузка событий...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <Calendar size={48} style={{ color: '#9CA3AF' }} />
              <p>Нет событий в этом месяце</p>
            </div>
          ) : (
            <div className="events-list">
              {events.map(event => {
                const typeInfo = getEventTypeInfo(event.event_type);
                return (
                  <div 
                    key={event.id} 
                    className="event-list-item"
                    onClick={() => setSelectedEvent(event)}
                    style={{ borderLeftColor: event.color || typeInfo.color }}
                  >
                    <div className="event-date-badge" style={{ backgroundColor: event.color || typeInfo.color }}>
                      <span className="event-day">{new Date(event.start_date).getDate()}</span>
                      <span className="event-month">{MONTHS[new Date(event.start_date).getMonth()].slice(0, 3)}</span>
                    </div>
                    <div className="event-details">
                      <div className="event-title-row">
                        <span className="event-icon">{typeInfo.icon}</span>
                        <h4>{event.title}</h4>
                        <span className="event-type-badge" style={{ backgroundColor: `${event.color || typeInfo.color}20`, color: event.color || typeInfo.color }}>
                          {typeInfo.label}
                        </span>
                      </div>
                      {event.description && (
                        <p className="event-description">{event.description}</p>
                      )}
                      <div className="event-meta">
                        {!event.is_all_day && event.start_time && (
                          <span className="meta-item">
                            <Clock size={14} />
                            {event.start_time}{event.end_time && ` - ${event.end_time}`}
                          </span>
                        )}
                        {event.location && (
                          <span className="meta-item">
                            <MapPin size={14} />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="event-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ backgroundColor: selectedEvent.color || getEventTypeInfo(selectedEvent.event_type).color }}>
              <div className="event-type-icon">
                {getEventTypeInfo(selectedEvent.event_type).icon}
              </div>
              <button className="close-btn" onClick={() => setSelectedEvent(null)}>
                <X size={20} color="white" />
              </button>
            </div>
            <div className="modal-body">
              <h3>{selectedEvent.title}</h3>
              <span className="event-type-label">
                {getEventTypeInfo(selectedEvent.event_type).label}
              </span>
              
              {selectedEvent.description && (
                <p className="event-description">{selectedEvent.description}</p>
              )}
              
              <div className="event-info-list">
                <div className="info-item">
                  <Calendar size={18} />
                  <span>
                    {new Date(selectedEvent.start_date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                    {selectedEvent.end_date && selectedEvent.end_date !== selectedEvent.start_date && (
                      ` - ${new Date(selectedEvent.end_date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}`
                    )}
                  </span>
                </div>
                
                {!selectedEvent.is_all_day && selectedEvent.start_time && (
                  <div className="info-item">
                    <Clock size={18} />
                    <span>{selectedEvent.start_time}{selectedEvent.end_time && ` - ${selectedEvent.end_time}`}</span>
                  </div>
                )}
                
                {selectedEvent.location && (
                  <div className="info-item">
                    <MapPin size={18} />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
              </div>
              
              {isTeacher && (
                <div className="modal-actions">
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                  >
                    Удалить событие
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-event-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Новое событие</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent}>
              <div className="form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Название события"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Тип события</label>
                <div className="event-type-selector">
                  {EVENT_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      className={`type-btn ${newEvent.event_type === type.value ? 'active' : ''}`}
                      onClick={() => setNewEvent(prev => ({ ...prev, event_type: type.value }))}
                      style={{
                        borderColor: newEvent.event_type === type.value ? type.color : '#E5E7EB',
                        backgroundColor: newEvent.event_type === type.value ? `${type.color}15` : 'white'
                      }}
                    >
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Дата начала *</label>
                  <input
                    type="date"
                    value={newEvent.start_date}
                    onChange={e => setNewEvent(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Дата окончания</label>
                  <input
                    type="date"
                    value={newEvent.end_date}
                    onChange={e => setNewEvent(prev => ({ ...prev, end_date: e.target.value }))}
                    min={newEvent.start_date}
                  />
                </div>
              </div>
              
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newEvent.is_all_day}
                    onChange={e => setNewEvent(prev => ({ ...prev, is_all_day: e.target.checked }))}
                  />
                  <span>Весь день</span>
                </label>
              </div>
              
              {!newEvent.is_all_day && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Время начала</label>
                    <input
                      type="time"
                      value={newEvent.start_time}
                      onChange={e => setNewEvent(prev => ({ ...prev, start_time: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Время окончания</label>
                    <input
                      type="time"
                      value={newEvent.end_time}
                      onChange={e => setNewEvent(prev => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label>Место проведения</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={e => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Например: Актовый зал"
                />
              </div>
              
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={newEvent.description}
                  onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Дополнительная информация о событии"
                  rows={3}
                />
              </div>
              
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="submit-btn" style={{ backgroundColor: moduleColor }}>
                  Создать событие
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
