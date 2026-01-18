import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';

import { BACKEND_URL } from '../config/api';
const API = `${BACKEND_URL}/api`;

function WorkCalendarWidget({ organizationId }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchEvents();
    }
  }, [organizationId, currentDate]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      // Fetch all upcoming events (we'll filter by month on frontend)
      const response = await fetch(
        `${API}/work/organizations/${organizationId}/events?upcoming_only=false`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

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

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthName = currentDate.toLocaleDateString('ru-RU', { 
    month: 'long', 
    year: 'numeric' 
  });

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  
  // Get first day of week (0 = Sunday, 1 = Monday, etc.)
  // Adjust to Monday start (1 = Monday, 0 = Sunday)
  let firstWeekDay = firstDayOfMonth.getDay();
  firstWeekDay = firstWeekDay === 0 ? 6 : firstWeekDay - 1;

  // Get events for specific date
  const getEventsForDate = (day) => {
    const dateStr = new Date(year, month, day).toDateString();
    return events.filter(event => {
      const eventDate = new Date(event.scheduled_date);
      return eventDate.toDateString() === dateStr;
    });
  };

  // Check if date has events
  const hasEvents = (day) => {
    return getEventsForDate(day).length > 0;
  };

  // Check if date is today
  const isToday = (day) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year;
  };

  // Check if date is selected
  const isSelected = (day) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day &&
           selectedDate.getMonth() === month &&
           selectedDate.getFullYear() === year;
  };

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (day) => {
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
  };

  // Generate calendar days
  const calendarDays = [];
  
  // Empty cells before first day
  for (let i = 0; i < firstWeekDay; i++) {
    calendarDays.push({ type: 'empty', key: `empty-${i}` });
  }
  
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      type: 'day',
      day,
      key: `day-${day}`,
      hasEvents: hasEvents(day),
      isToday: isToday(day),
      isSelected: isSelected(day),
      events: getEventsForDate(day)
    });
  }

  // Selected date events
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate.getDate()) : [];

  const getEventTypeEmoji = (type) => {
    const types = {
      'MEETING': '👥',
      'TRAINING': '📚',
      'DEADLINE': '⏰',
      'COMPANY_EVENT': '🎉',
      'TEAM_BUILDING': '🤝',
      'REVIEW': '📝',
      'ANNOUNCEMENT': '📢',
      'OTHER': '📌'
    };
    return types[type] || '📌';
  };

  return (
    <div className="work-calendar-widget">
      <div className="widget-header">
        <Calendar size={18} />
        <h4>Календарь событий</h4>
      </div>

      {/* Calendar Navigation */}
      <div className="calendar-nav">
        <button className="calendar-nav-btn" onClick={goToPreviousMonth}>
          <ChevronLeft size={18} />
        </button>
        <div className="calendar-month-label">{monthName}</div>
        <button className="calendar-nav-btn" onClick={goToNextMonth}>
          <ChevronRight size={18} />
        </button>
      </div>

      <button className="calendar-today-btn" onClick={goToToday}>
        Сегодня
      </button>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Weekday headers */}
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, idx) => (
          <div key={`weekday-${idx}`} className="calendar-weekday">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((item) => {
          if (item.type === 'empty') {
            return <div key={item.key} className="calendar-day empty" />;
          }

          return (
            <div
              key={item.key}
              className={`calendar-day ${
                item.isToday ? 'today' : ''
              } ${
                item.isSelected ? 'selected' : ''
              } ${
                item.hasEvents ? 'has-events' : ''
              }`}
              onClick={() => handleDateClick(item.day)}
            >
              <span className="day-number">{item.day}</span>
              {item.hasEvents && (
                <div className="event-dots">
                  {item.events.slice(0, 3).map((event, idx) => (
                    <span key={idx} className="event-dot" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Date Events */}
      {selectedDate && selectedDateEvents.length > 0 && (
        <div className="calendar-events-list">
          <div className="events-list-header">
            <span className="events-date">
              {selectedDate.toLocaleDateString('ru-RU', { 
                day: 'numeric', 
                month: 'long' 
              })}
            </span>
            <span className="events-count">
              {selectedDateEvents.length} {selectedDateEvents.length === 1 ? 'событие' : 'событий'}
            </span>
          </div>
          <div className="events-list-items">
            {selectedDateEvents.map((event) => (
              <div key={event.id} className="calendar-event-item">
                <span className="event-emoji">{getEventTypeEmoji(event.event_type)}</span>
                <div className="event-info">
                  <div className="event-title">{event.title}</div>
                  <div className="event-details">
                    {event.scheduled_time && (
                      <span className="event-time">
                        <Clock size={12} />
                        {event.scheduled_time}
                      </span>
                    )}
                    {event.location && (
                      <span className="event-location">
                        <MapPin size={12} />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDate && selectedDateEvents.length === 0 && (
        <div className="calendar-no-events">
          <Calendar size={24} opacity={0.3} />
          <p>Нет событий на эту дату</p>
        </div>
      )}
    </div>
  );
}

export default WorkCalendarWidget;
