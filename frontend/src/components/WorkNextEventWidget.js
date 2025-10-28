import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, ChevronRight, X, Users, Bell, CheckCircle, XCircle, HelpCircle, Eye } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function WorkNextEventWidget({ organizationId, onEventClick }) {
  const [nextEvent, setNextEvent] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

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
    if (!nextEvent || !nextEvent.rsvp_responses) return null;
    
    const responses = nextEvent.rsvp_responses;
    const going = Object.values(responses).filter(r => r === 'GOING').length;
    const maybe = Object.values(responses).filter(r => r === 'MAYBE').length;
    const notGoing = Object.values(responses).filter(r => r === 'NOT_GOING').length;
    
    return { going, maybe, notGoing };
  };

  const handleWidgetClick = (e) => {
    e.stopPropagation();
    setShowModal(true);
    if (onEventClick) {
      onEventClick(nextEvent);
    }
  };

  // Modal component that renders via portal
  const EventModal = () => {
    if (!showModal) return null;

    const modalContent = (
      <div className="event-modal-overlay" onClick={(e) => {
        if (e.target.className === 'event-modal-overlay') {
          setShowModal(false);
        }
      }}>
        <div className="event-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="event-modal-header">
            <div className="event-modal-title">
              <span className="event-modal-emoji">{getEventTypeEmoji(nextEvent.event_type)}</span>
              <div>
                <h2>{nextEvent.title}</h2>
                <span className="event-type-badge">{getEventTypeLabel(nextEvent.event_type)}</span>
              </div>
            </div>
            <button className="close-modal-btn" onClick={() => setShowModal(false)}>
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
                  <div className="modal-detail-value">{formatDate(nextEvent.scheduled_date)}</div>
                </div>
              </div>

              {nextEvent.scheduled_time && (
                <div className="modal-detail-row">
                  <Clock size={20} />
                  <div>
                    <div className="modal-detail-label">Время</div>
                    <div className="modal-detail-value">
                      {nextEvent.scheduled_time}
                      {nextEvent.end_time && ` - ${nextEvent.end_time}`}
                    </div>
                  </div>
                </div>
              )}

              {nextEvent.location && (
                <div className="modal-detail-row">
                  <MapPin size={20} />
                  <div>
                    <div className="modal-detail-label">Место</div>
                    <div className="modal-detail-value">{nextEvent.location}</div>
                  </div>
                </div>
              )}

              {nextEvent.description && (
                <div className="modal-description">
                  <h4>Описание</h4>
                  <p>{nextEvent.description}</p>
                </div>
              )}
            </div>

            {/* RSVP Stats */}
            {nextEvent.rsvp_enabled && getRSVPStats() && (
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
            {nextEvent.reminder_intervals && nextEvent.reminder_intervals.length > 0 && (
              <div className="modal-reminders-section">
                <h4><Bell size={18} /> Напоминания</h4>
                <div className="reminder-tags">
                  {nextEvent.reminder_intervals.map((interval, idx) => (
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
            <button className="modal-btn secondary" onClick={() => setShowModal(false)}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );

    // Render modal via portal to document body
    return ReactDOM.createPortal(modalContent, document.body);
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

      <EventModal />
    </>
  );
}

export default WorkNextEventWidget;
