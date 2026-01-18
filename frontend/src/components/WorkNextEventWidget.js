import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, X, Users, Bell, CheckCircle, XCircle, HelpCircle, Eye } from 'lucide-react';

import { BACKEND_URL } from '../config/api';
const API = `${BACKEND_URL}/api`;

// Separate Modal Component that doesn't re-render with countdown
const EventDetailsModal = React.memo(({ event, onClose, timeLeft, onRSVPUpdate }) => {
  const [userRSVP, setUserRSVP] = React.useState(event?.user_rsvp_status || null);
  const [rsvpStats, setRsvpStats] = React.useState(event?.rsvp_summary || { GOING: 0, MAYBE: 0, NOT_GOING: 0 });
  const [updating, setUpdating] = React.useState(false);

  if (!event) return null;

  const handleRSVP = async (status) => {
    if (updating) return;
    
    setUpdating(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${API}/work/organizations/${event.organization_id}/events/${event.id}/rsvp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        await response.json();
        
        // Update local state
        const oldStatus = userRSVP;
        setUserRSVP(status);
        
        // Update stats optimistically
        const newStats = { ...rsvpStats };
        if (oldStatus) {
          newStats[oldStatus] = Math.max(0, (newStats[oldStatus] || 0) - 1);
        }
        newStats[status] = (newStats[status] || 0) + 1;
        setRsvpStats(newStats);
        
        // Call parent update callback
        if (onRSVPUpdate) {
          onRSVPUpdate(event.id, status, newStats);
        }
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
    } finally {
      setUpdating(false);
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

  const getEventTypeLabel = (type) => {
    const labels = {
      'MEETING': 'Встреча',
      'TRAINING': 'Обучение',
      'DEADLINE': 'Дедлайн',
      'COMPANY_EVENT': 'Мероприятие',
      'TEAM_BUILDING': 'Тимбилдинг',
      'REVIEW': 'Ревью',
      'ANNOUNCEMENT': 'Объявление',
      'OTHER': 'Другое'
    };
    return labels[type] || 'Событие';
  };

  const getRSVPStats = () => {
    return {
      going: rsvpStats.GOING || 0,
      maybe: rsvpStats.MAYBE || 0,
      notGoing: rsvpStats.NOT_GOING || 0
    };
  };

  return (
    <div className="event-modal-overlay" onClick={(e) => {
      if (e.target.className === 'event-modal-overlay') {
        onClose();
      }
    }}>
      <div className="event-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="event-modal-header">
          <div className="event-modal-title">
            <span className="event-modal-emoji">{getEventTypeEmoji(event.event_type)}</span>
            <div>
              <h2>{event.title}</h2>
              <span className="event-type-badge">{getEventTypeLabel(event.event_type)}</span>
            </div>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="event-modal-body">
          {/* Countdown Section */}
          {timeLeft && !timeLeft.expired && (
            <div className="modal-countdown-section">
              <h3>⏱️ Событие начнется через:</h3>
              <div className="modal-countdown">
                {timeLeft.days > 0 && (
                  <div className="modal-countdown-item">
                    <div className="modal-countdown-value">{timeLeft.days}</div>
                    <div className="modal-countdown-label">{timeLeft.days === 1 ? 'день' : 'дней'}</div>
                  </div>
                )}
                <div className="modal-countdown-item">
                  <div className="modal-countdown-value">{String(timeLeft.hours).padStart(2, '0')}</div>
                  <div className="modal-countdown-label">часов</div>
                </div>
                <div className="modal-countdown-sep">:</div>
                <div className="modal-countdown-item">
                  <div className="modal-countdown-value">{String(timeLeft.minutes).padStart(2, '0')}</div>
                  <div className="modal-countdown-label">минут</div>
                </div>
                <div className="modal-countdown-sep">:</div>
                <div className="modal-countdown-item">
                  <div className="modal-countdown-value">{String(timeLeft.seconds).padStart(2, '0')}</div>
                  <div className="modal-countdown-label">секунд</div>
                </div>
              </div>
            </div>
          )}

          {/* Event Details */}
          <div className="modal-details-section">
            <div className="modal-detail-row">
              <Calendar size={20} />
              <div>
                <div className="modal-detail-label">Дата</div>
                <div className="modal-detail-value">{formatDate(event.scheduled_date)}</div>
              </div>
            </div>

            {event.scheduled_time && (
              <div className="modal-detail-row">
                <Clock size={20} />
                <div>
                  <div className="modal-detail-label">Время</div>
                  <div className="modal-detail-value">
                    {event.scheduled_time}
                    {event.end_time && ` - ${event.end_time}`}
                  </div>
                </div>
              </div>
            )}

            {event.location && (
              <div className="modal-detail-row">
                <MapPin size={20} />
                <div>
                  <div className="modal-detail-label">Место</div>
                  <div className="modal-detail-value">{event.location}</div>
                </div>
              </div>
            )}

            {event.description && (
              <div className="modal-description">
                <h4>Описание</h4>
                <p>{event.description}</p>
              </div>
            )}
          </div>

          {/* RSVP Stats */}
          {event.rsvp_enabled && (
            <div className="modal-rsvp-section">
              <h4><Users size={18} /> Участники</h4>
              <div className="rsvp-stats">
                <div className="rsvp-stat-item going">
                  <CheckCircle size={16} />
                  <span className="rsvp-stat-count">{getRSVPStats().going}</span>
                  <span className="rsvp-stat-label">Придут</span>
                </div>
                <div className="rsvp-stat-item maybe">
                  <HelpCircle size={16} />
                  <span className="rsvp-stat-count">{getRSVPStats().maybe}</span>
                  <span className="rsvp-stat-label">Возможно</span>
                </div>
                <div className="rsvp-stat-item not-going">
                  <XCircle size={16} />
                  <span className="rsvp-stat-count">{getRSVPStats().notGoing}</span>
                  <span className="rsvp-stat-label">Не придут</span>
                </div>
              </div>
            </div>
          )}

          {/* Reminders */}
          {event.reminder_intervals && event.reminder_intervals.length > 0 && (
            <div className="modal-reminders-section">
              <h4><Bell size={18} /> Напоминания</h4>
              <div className="reminder-tags">
                {event.reminder_intervals.map((interval, idx) => (
                  <span key={idx} className="reminder-tag">
                    {interval === '15_MINUTES' && '🔔 За 15 минут'}
                    {interval === '1_HOUR' && '🔔 За 1 час'}
                    {interval === '1_DAY' && '🔔 За 1 день'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="event-modal-footer">
          {event.rsvp_enabled && (
            <div className="modal-rsvp-actions">
              <span className="rsvp-question">Вы пойдете?</span>
              <div className="rsvp-buttons">
                <button 
                  className={`rsvp-action-btn going ${userRSVP === 'GOING' ? 'active' : ''}`}
                  onClick={() => handleRSVP('GOING')}
                  disabled={updating}
                >
                  <CheckCircle size={18} />
                  {userRSVP === 'GOING' ? 'Иду' : 'Приду'}
                </button>
                <button 
                  className={`rsvp-action-btn maybe ${userRSVP === 'MAYBE' ? 'active' : ''}`}
                  onClick={() => handleRSVP('MAYBE')}
                  disabled={updating}
                >
                  <HelpCircle size={18} />
                  Возможно
                </button>
                <button 
                  className={`rsvp-action-btn not-going ${userRSVP === 'NOT_GOING' ? 'active' : ''}`}
                  onClick={() => handleRSVP('NOT_GOING')}
                  disabled={updating}
                >
                  <XCircle size={18} />
                  Не приду
                </button>
              </div>
            </div>
          )}
          <button className="modal-btn secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
});

function WorkNextEventWidget({ organizationId, onEventClick }) {
  const [nextEvent, setNextEvent] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

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

  // Helper functions for the main widget display
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

  const handleWidgetClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleRSVPUpdate = useCallback((eventId, status, newStats) => {
    // Update local event data
    if (nextEvent && nextEvent.id === eventId) {
      setNextEvent(prev => ({
        ...prev,
        user_rsvp_status: status,
        rsvp_summary: newStats
      }));
    }
  }, [nextEvent]);

  // Memoized modal to prevent unnecessary re-renders
  const EventModal = useMemo(() => {
    if (!showModal || !nextEvent) return null;
    
    return ReactDOM.createPortal(
      <EventDetailsModal 
        event={nextEvent} 
        onClose={handleCloseModal} 
        timeLeft={timeLeft}
        onRSVPUpdate={handleRSVPUpdate}
      />, 
      document.body
    );
  }, [showModal, nextEvent, timeLeft, handleCloseModal, handleRSVPUpdate]);

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
    <>
      <div className="work-next-event-widget active">
        <div className="widget-header">
          <Calendar size={18} />
          <h4>Следующее событие</h4>
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

          <button className="view-event-details-btn" onClick={handleWidgetClick}>
            <Eye size={16} />
            Подробнее
          </button>
        </div>
      </div>

      {EventModal}
    </>
  );
}

export default WorkNextEventWidget;
