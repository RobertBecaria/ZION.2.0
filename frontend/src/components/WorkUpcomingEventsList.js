import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BACKEND_URL } from '../config/api';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react';

// Import the existing EventDetailsModal
import WorkNextEventWidget from './WorkNextEventWidget';

const API = `${BACKEND_URL}/api`;

// Separate EventDetailsModal import (we'll use the one from WorkNextEventWidget)
// For now, we'll create a simpler version

function WorkUpcomingEventsList({ organizationId, maxEvents = 5 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [timers, setTimers] = useState({});

  useEffect(() => {
    if (organizationId) {
      fetchEvents();
    }
  }, [organizationId]);

  useEffect(() => {
    if (events.length === 0) return;

    // Update all countdowns every second
    const interval = setInterval(() => {
      const newTimers = {};
      events.forEach(event => {
        const timeLeft = calculateTimeLeft(event.scheduled_date);
        newTimers[event.id] = timeLeft;
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [events]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${API}/work/organizations/${organizationId}/events?upcoming_only=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.events && data.events.length > 0) {
          // Sort by date and take first maxEvents
          const sorted = data.events
            .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
            .slice(0, maxEvents);
          setEvents(sorted);
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeLeft = (dateString) => {
    const eventDate = new Date(dateString);
    const now = new Date();
    const difference = eventDate - now;

    if (difference <= 0) {
      return { expired: true };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, expired: false };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'short'
    });
  };

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

  const formatTimeLeft = (timeLeft) => {
    if (!timeLeft || timeLeft.expired) return 'Началось';

    if (timeLeft.days > 0) {
      return `${timeLeft.days}д ${timeLeft.hours}ч`;
    } else if (timeLeft.hours > 0) {
      return `${timeLeft.hours}ч ${timeLeft.minutes}м`;
    } else {
      return `${timeLeft.minutes}м`;
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setSelectedEvent(null);
  }, []);

  if (loading) {
    return (
      <div className="work-events-list-widget">
        <div className="widget-header">
          <Calendar size={18} />
          <h4>Ближайшие события</h4>
        </div>
        <div className="events-list-loading">Загрузка...</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="work-events-list-widget">
        <div className="widget-header">
          <Calendar size={18} />
          <h4>Ближайшие события</h4>
        </div>
        <div className="events-list-empty">
          <Calendar size={32} opacity={0.3} />
          <p>Нет запланированных событий</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="work-events-list-widget">
        <div className="widget-header">
          <Calendar size={18} />
          <h4>Ближайшие события ({events.length})</h4>
        </div>

        <div className="events-list-container">
          {events.map((event) => {
            const timeLeft = timers[event.id];
            return (
              <div 
                key={event.id} 
                className="event-list-item"
                onClick={() => handleEventClick(event)}
              >
                <div className="event-item-icon">
                  {getEventTypeEmoji(event.event_type)}
                </div>
                
                <div className="event-item-content">
                  <div className="event-item-title">{event.title}</div>
                  <div className="event-item-details">
                    <span className="event-item-date">
                      <Calendar size={12} />
                      {formatDate(event.scheduled_date)}
                    </span>
                    {event.scheduled_time && (
                      <span className="event-item-time">
                        <Clock size={12} />
                        {event.scheduled_time}
                      </span>
                    )}
                  </div>
                </div>

                <div className="event-item-countdown">
                  <div className="countdown-badge">
                    {formatTimeLeft(timeLeft)}
                  </div>
                  <ChevronRight size={16} className="event-item-chevron" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for selected event */}
      {showModal && selectedEvent && (
        <div className="event-modal-overlay" onClick={(e) => {
          if (e.target.className === 'event-modal-overlay') {
            handleCloseModal();
          }
        }}>
          <div className="event-list-modal-placeholder">
            <p>Event details modal will be integrated here</p>
            <p>Event: {selectedEvent.title}</p>
            <button onClick={handleCloseModal}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export default WorkUpcomingEventsList;
