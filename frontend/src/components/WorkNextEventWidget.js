import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function WorkNextEventWidget({ organizationId, onEventClick }) {
  const [nextEvent, setNextEvent] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchNextEvent();
    }
  }, [organizationId]);

  useEffect(() => {
    if (!nextEvent) return;

    const calculateTimeLeft = () => {
      const eventDate = new Date(nextEvent.scheduled_date);
      const now = new Date();
      const difference = eventDate - now;

      if (difference <= 0) {
        setTimeLeft({ expired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [nextEvent]);

  const fetchNextEvent = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${API}/work/organizations/${organizationId}/events?upcoming_only=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.events && data.events.length > 0) {
          // Get the next upcoming event (sorted by date)
          const sorted = data.events.sort((a, b) => 
            new Date(a.scheduled_date) - new Date(b.scheduled_date)
          );
          setNextEvent(sorted[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching next event:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
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

  if (loading) {
    return (
      <div className="work-next-event-widget loading">
        <div className="widget-header">
          <Calendar size={18} />
          <h4>Следующее событие</h4>
        </div>
        <div className="widget-loading">Загрузка...</div>
      </div>
    );
  }

  if (!nextEvent) {
    return (
      <div className="work-next-event-widget empty">
        <div className="widget-header">
          <Calendar size={18} />
          <h4>Следующее событие</h4>
        </div>
        <div className="widget-empty">
          <Calendar size={32} opacity={0.3} />
          <p>Нет запланированных событий</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="work-next-event-widget active"
      onClick={() => onEventClick && onEventClick(nextEvent)}
      style={{ cursor: 'pointer' }}
    >
      <div className="widget-header">
        <Calendar size={18} />
        <h4>Следующее событие</h4>
        <ChevronRight size={16} className="chevron-icon" />
      </div>

      <div className="event-content">
        <div className="event-type">
          <span className="event-emoji">{getEventTypeEmoji(nextEvent.event_type)}</span>
          <span className="event-title">{nextEvent.title}</span>
        </div>

        {timeLeft && !timeLeft.expired && (
          <div className="countdown-timer">
            <div className="countdown-grid">
              {timeLeft.days > 0 && (
                <div className="countdown-item">
                  <div className="countdown-value">{timeLeft.days}</div>
                  <div className="countdown-label">{timeLeft.days === 1 ? 'день' : 'дней'}</div>
                </div>
              )}
              <div className="countdown-item">
                <div className="countdown-value">{String(timeLeft.hours).padStart(2, '0')}</div>
                <div className="countdown-label">час</div>
              </div>
              <div className="countdown-separator">:</div>
              <div className="countdown-item">
                <div className="countdown-value">{String(timeLeft.minutes).padStart(2, '0')}</div>
                <div className="countdown-label">мин</div>
              </div>
              <div className="countdown-separator">:</div>
              <div className="countdown-item">
                <div className="countdown-value">{String(timeLeft.seconds).padStart(2, '0')}</div>
                <div className="countdown-label">сек</div>
              </div>
            </div>
          </div>
        )}

        {timeLeft && timeLeft.expired && (
          <div className="event-expired">
            <span className="expired-badge">Событие началось</span>
          </div>
        )}

        <div className="event-details">
          <div className="event-detail-row">
            <Calendar size={14} />
            <span>{formatDate(nextEvent.scheduled_date)}</span>
          </div>
          {nextEvent.scheduled_time && (
            <div className="event-detail-row">
              <Clock size={14} />
              <span>{nextEvent.scheduled_time}</span>
            </div>
          )}
          {nextEvent.location && (
            <div className="event-detail-row">
              <MapPin size={14} />
              <span>{nextEvent.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkNextEventWidget;
