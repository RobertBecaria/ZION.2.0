/**
 * EventPlanner Component
 * Comprehensive event planning system with calendar view, list view,
 * RSVP functionality, role-based color coding, and countdown timers.
 * 
 * Supports:
 * - School administrators (Red events)
 * - Teachers (Blue events)
 * - Parents (Green events)
 * - Students/Kids (Yellow events - Birthday parties)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, MapPin,
  Users, Check, HelpCircle, XCircle, Gift, PartyPopper, Bell,
  GraduationCap, FileText, Award, BookOpen, Briefcase, Heart,
  Edit2, Trash2, UserCheck, Timer, ChevronDown
} from 'lucide-react';

// Event type configurations
const EVENT_TYPES = [
  { value: 'HOLIDAY', label: 'Праздник', icon: '🎉', color: '#10B981' },
  { value: 'EXAM', label: 'Экзамен', icon: '📝', color: '#EF4444' },
  { value: 'MEETING', label: 'Родительское собрание', icon: '👥', color: '#3B82F6' },
  { value: 'EVENT', label: 'Мероприятие', icon: '🎭', color: '#8B5CF6' },
  { value: 'DEADLINE', label: 'Дедлайн', icon: '⏰', color: '#F59E0B' },
  { value: 'VACATION', label: 'Каникулы', icon: '🏖️', color: '#06B6D4' },
  { value: 'CONFERENCE', label: 'Конференция', icon: '🎤', color: '#EC4899' },
  { value: 'COMPETITION', label: 'Соревнование', icon: '🏆', color: '#F97316' },
  { value: 'BIRTHDAY', label: 'День рождения', icon: '🎂', color: '#EAB308' },
  { value: 'EXCURSION', label: 'Экскурсия', icon: '🚌', color: '#14B8A6' }
];

// Creator role configurations
const CREATOR_ROLES = {
  ADMIN: { label: 'Администрация', color: '#DC2626', icon: '🏫' },
  TEACHER: { label: 'Учитель', color: '#2563EB', icon: '👨‍🏫' },
  PARENT: { label: 'Родитель', color: '#16A34A', icon: '👨‍👩‍👧' },
  STUDENT: { label: 'Ученик', color: '#EAB308', icon: '👧' }
};

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const EventPlanner = ({ 
  organizationId, 
  schoolRoles, 
  user, 
  moduleColor = '#6D28D9',
  viewType = 'full' // 'full' | 'widget' | 'calendar-only'
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'list'
  const [showEventTypeFilter, setShowEventTypeFilter] = useState(false);
  const [selectedEventTypes, setSelectedEventTypes] = useState([]);
  const [rsvpLoading, setRsvpLoading] = useState(null);
  
  // Birthday party specific state
  const [showBirthdayForm, setShowBirthdayForm] = useState(false);
  const [classmates, setClassmates] = useState([]);
  const [loadingClassmates, setLoadingClassmates] = useState(false);
  const [selectedClassmates, setSelectedClassmates] = useState([]);
  const [birthdayPartyData, setBirthdayPartyData] = useState({
    theme: 'PINK', // PINK or BLUE
    custom_message: '',
    wish_list: [],
    birthday_child_name: '',
    birthday_child_age: null
  });
  const [wishInput, setWishInput] = useState('');
  const [flashingInvitations, setFlashingInvitations] = useState([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  
  // Preset event templates
  const [showPresets, setShowPresets] = useState(false);
  const eventPresets = [
    { title: 'Родительское собрание', event_type: 'MEETING', requires_rsvp: true, icon: '👥' },
    { title: 'Школьный праздник', event_type: 'EVENT', icon: '🎉' },
    { title: 'Контрольная работа', event_type: 'EXAM', icon: '📝' },
    { title: 'День рождения', event_type: 'BIRTHDAY', requires_rsvp: true, max_attendees: 20, icon: '🎂' },
    { title: 'Экскурсия', event_type: 'EXCURSION', requires_rsvp: true, icon: '🚌' },
    { title: 'Спортивное соревнование', event_type: 'COMPETITION', icon: '🏆' }
  ];
  
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
    audience_type: 'PUBLIC',
    requires_rsvp: false,
    max_attendees: null
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // Determine user's role capabilities
  const isTeacher = schoolRoles?.is_teacher && 
    schoolRoles?.schools_as_teacher?.some(s => s.organization_id === organizationId);
  const isAdmin = schoolRoles?.is_admin || user?.role === 'admin';
  const isParent = schoolRoles?.is_parent || user?.children?.length > 0;
  const canCreateEvents = isTeacher || isAdmin || isParent;

  const fetchEvents = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      
      let url = `${BACKEND_URL}/api/journal/organizations/${organizationId}/calendar?month=${month}&year=${year}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        let data = await response.json();
        
        // Apply event type filter if any
        if (selectedEventTypes.length > 0) {
          data = data.filter(e => selectedEventTypes.includes(e.event_type));
        }
        
        setEvents(data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, currentDate, selectedEventTypes, BACKEND_URL]);

  useEffect(() => {
    if (organizationId) {
      fetchEvents();
    }
  }, [fetchEvents, organizationId]);

  // Fetch classmates for birthday party invitations
  const fetchClassmates = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      setLoadingClassmates(true);
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${BACKEND_URL}/api/journal/organizations/${organizationId}/classmates`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setClassmates(data.classmates || []);
      }
    } catch (error) {
      console.error('Error fetching classmates:', error);
    } finally {
      setLoadingClassmates(false);
    }
  }, [organizationId, BACKEND_URL]);

  // Fetch classmates when birthday form is shown
  useEffect(() => {
    if (showBirthdayForm && organizationId) {
      fetchClassmates();
    }
  }, [showBirthdayForm, organizationId, fetchClassmates]);

  // Flash animation for pending birthday invitations
  useEffect(() => {
    if (events.length > 0) {
      // Find birthday events where current user is invited but hasn't RSVPed
      const pendingInvitations = events.filter(e => 
        e.event_type === 'BIRTHDAY' && 
        e.requires_rsvp && 
        !e.user_rsvp && 
        (e.invitees?.includes(user?.id) || e.audience_type === 'PUBLIC')
      );
      
      if (pendingInvitations.length > 0) {
        setFlashingInvitations(pendingInvitations.map(e => e.id));
        
        // Stop flashing after 3 seconds
        const timer = setTimeout(() => {
          setFlashingInvitations([]);
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [events, user?.id]);

  // Handle classmate selection toggle
  const toggleClassmateSelection = (classmateId) => {
    setSelectedClassmates(prev => 
      prev.includes(classmateId)
        ? prev.filter(id => id !== classmateId)
        : [...prev, classmateId]
    );
  };

  // Add wish to wish list
  const addWish = () => {
    if (wishInput.trim()) {
      setBirthdayPartyData(prev => ({
        ...prev,
        wish_list: [...prev.wish_list, wishInput.trim()]
      }));
      setWishInput('');
    }
  };

  // Remove wish from list
  const removeWish = (index) => {
    setBirthdayPartyData(prev => ({
      ...prev,
      wish_list: prev.wish_list.filter((_, i) => i !== index)
    }));
  };

  // Reset birthday party form
  const resetBirthdayForm = () => {
    setBirthdayPartyData({
      theme: 'PINK',
      custom_message: '',
      wish_list: [],
      birthday_child_name: '',
      birthday_child_age: null
    });
    setSelectedClassmates([]);
    setWishInput('');
    setShowBirthdayForm(false);
  };

  // Countdown timer helper
  const getCountdown = (dateStr, timeStr) => {
    const eventDate = new Date(dateStr);
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':');
      eventDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    const now = new Date();
    const diff = eventDate - now;
    
    if (diff <= 0) return { label: 'Прошло', expired: true };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return { label: `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`, days, hours, minutes };
    } else if (hours > 0) {
      return { label: `${hours} ч ${minutes} мин`, hours, minutes };
    } else {
      return { label: `${minutes} мин`, minutes };
    }
  };

  // RSVP handler
  const handleRSVP = async (eventId, status, dietaryRestrictionsInput = null) => {
    try {
      setRsvpLoading(eventId);
      const token = localStorage.getItem('zion_token');
      
      const body = { status };
      if (dietaryRestrictionsInput) {
        body.dietary_restrictions = dietaryRestrictionsInput;
      }
      
      const response = await fetch(
        `${BACKEND_URL}/api/journal/calendar/${eventId}/rsvp`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Update local event state
        setEvents(prev => prev.map(e => 
          e.id === eventId 
            ? { ...e, user_rsvp: status, rsvp_summary: result.rsvp_summary }
            : e
        ));
        if (selectedEvent?.id === eventId) {
          setSelectedEvent(prev => ({ ...prev, user_rsvp: status, rsvp_summary: result.rsvp_summary }));
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при обновлении RSVP');
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
    } finally {
      setRsvpLoading(null);
    }
  };

  const handleCreateEvent = async (e) => {
    e?.preventDefault();
    if (!newEvent.title || !newEvent.start_date) return;

    try {
      const token = localStorage.getItem('zion_token');
      
      // Build event payload
      const eventPayload = {
        ...newEvent,
        max_attendees: newEvent.max_attendees ? parseInt(newEvent.max_attendees) : null
      };
      
      // Add birthday party specific data if event type is BIRTHDAY
      if (newEvent.event_type === 'BIRTHDAY') {
        eventPayload.birthday_party_data = birthdayPartyData;
        eventPayload.invitees = selectedClassmates.map(c => c.user_id || c.id);
        eventPayload.requires_rsvp = true; // Birthday parties always need RSVP
      }
      
      const response = await fetch(
        `${BACKEND_URL}/api/journal/organizations/${organizationId}/calendar`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(eventPayload)
        }
      );

      if (response.ok) {
        setShowCreateModal(false);
        resetEventForm();
        resetBirthdayForm();
        fetchEvents();
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при создании события');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Ошибка при создании события');
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

  const resetEventForm = () => {
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
      audience_type: 'PUBLIC',
      requires_rsvp: false,
      max_attendees: null
    });
    setShowPresets(false);
  };

  const applyPreset = (preset) => {
    setNewEvent(prev => ({
      ...prev,
      title: preset.title,
      event_type: preset.event_type,
      requires_rsvp: preset.requires_rsvp || false,
      max_attendees: preset.max_attendees || null
    }));
    
    // Show birthday form if birthday preset is selected
    if (preset.event_type === 'BIRTHDAY') {
      setShowBirthdayForm(true);
    } else {
      setShowBirthdayForm(false);
    }
    
    setShowPresets(false);
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, date: null });
    }
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

  const getCreatorRoleInfo = (role) => {
    return CREATOR_ROLES[role] || CREATOR_ROLES.PARENT;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  // Sort events by upcoming first
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.start_date + (a.start_time ? `T${a.start_time}` : ''));
    const dateB = new Date(b.start_date + (b.start_time ? `T${b.start_time}` : ''));
    return dateA - dateB;
  });

  // Separate upcoming events for countdown display
  const upcomingEvents = sortedEvents.filter(e => {
    const eventDate = new Date(e.start_date);
    return eventDate >= new Date().setHours(0,0,0,0);
  }).slice(0, 5);

  const days = getDaysInMonth(currentDate);
  const today = new Date().toISOString().split('T')[0];

  // Render RSVP buttons with dietary restrictions for birthday parties
  const renderRSVPButtons = (event, showDietaryInput = false) => {
    if (!event.requires_rsvp) return null;
    
    const isLoading = rsvpLoading === event.id;
    const isBirthday = event.event_type === 'BIRTHDAY';
    
    const handleRSVPWithDietary = (status) => {
      if (isBirthday && status === 'YES' && dietaryRestrictions) {
        handleRSVP(event.id, status, dietaryRestrictions);
      } else {
        handleRSVP(event.id, status);
      }
      setDietaryRestrictions('');
    };
    
    return (
      <div className="rsvp-section-wrapper">
        <div className="rsvp-buttons">
          <button
            className={`rsvp-btn yes ${event.user_rsvp === 'YES' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleRSVPWithDietary('YES'); }}
            disabled={isLoading}
            title="Приду"
          >
            <Check size={16} />
            <span>Да</span>
            {event.rsvp_summary?.YES > 0 && <span className="count">{event.rsvp_summary.YES}</span>}
          </button>
          <button
            className={`rsvp-btn maybe ${event.user_rsvp === 'MAYBE' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleRSVPWithDietary('MAYBE'); }}
            disabled={isLoading}
            title="Возможно"
          >
            <HelpCircle size={16} />
            <span>Может быть</span>
            {event.rsvp_summary?.MAYBE > 0 && <span className="count">{event.rsvp_summary.MAYBE}</span>}
          </button>
          <button
            className={`rsvp-btn no ${event.user_rsvp === 'NO' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleRSVPWithDietary('NO'); }}
            disabled={isLoading}
            title="Не приду"
          >
            <XCircle size={16} />
            <span>Нет</span>
            {event.rsvp_summary?.NO > 0 && <span className="count">{event.rsvp_summary.NO}</span>}
          </button>
        </div>
        
        {/* Dietary restrictions input for birthday parties */}
        {isBirthday && showDietaryInput && !event.user_rsvp && (
          <div className="dietary-input" style={{ marginTop: '12px' }}>
            <label style={{ 
              fontSize: '13px', 
              color: '#6B7280', 
              display: 'block', 
              marginBottom: '6px'
            }}>
              🍽️ Есть ли аллергии или ограничения в питании?
            </label>
            <input
              type="text"
              value={dietaryRestrictions}
              onChange={e => setDietaryRestrictions(e.target.value)}
              placeholder="Например: Нет орехов, вегетарианец..."
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                fontSize: '14px'
              }}
            />
          </div>
        )}
      </div>
    );
  };

  // Widget view (compact for sidebar)
  if (viewType === 'widget') {
    return (
      <div className="event-planner-widget" style={{ '--module-color': moduleColor }}>
        <div className="widget-header">
          <h3><Calendar size={18} /> События</h3>
          {canCreateEvents && (
            <button 
              className="add-btn"
              onClick={() => setShowCreateModal(true)}
              style={{ backgroundColor: moduleColor }}
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        
        {upcomingEvents.length === 0 ? (
          <div className="widget-empty">
            <Calendar size={32} style={{ color: `${moduleColor}60` }} />
            <p>Нет предстоящих событий</p>
          </div>
        ) : (
          <div className="widget-events">
            {upcomingEvents.map(event => {
              const typeInfo = getEventTypeInfo(event.event_type);
              const roleInfo = getCreatorRoleInfo(event.creator_role);
              const countdown = getCountdown(event.start_date, event.start_time);
              
              return (
                <div 
                  key={event.id}
                  className="widget-event-item"
                  onClick={() => setSelectedEvent(event)}
                  style={{ borderLeftColor: event.role_color || roleInfo.color }}
                >
                  <div className="event-icon" style={{ backgroundColor: `${typeInfo.color}20` }}>
                    {typeInfo.icon}
                  </div>
                  <div className="event-info">
                    <h4>{event.title}</h4>
                    <div className="event-meta">
                      <span className="date">
                        {new Date(event.start_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                      {!countdown.expired && (
                        <span className="countdown" style={{ color: moduleColor }}>
                          <Timer size={12} /> {countdown.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div 
                    className="creator-badge"
                    style={{ backgroundColor: `${event.role_color || roleInfo.color}20`, color: event.role_color || roleInfo.color }}
                    title={roleInfo.label}
                  >
                    {roleInfo.icon}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Event Detail Modal */}
        {selectedEvent && renderEventDetailModal()}
        
        {/* Create Event Modal */}
        {showCreateModal && renderCreateEventModal()}
      </div>
    );
  }

  // Full calendar view
  const renderEventDetailModal = () => (
    <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
      <div className="event-detail-modal" onClick={e => e.stopPropagation()}>
        <div 
          className="modal-header" 
          style={{ backgroundColor: selectedEvent.role_color || getCreatorRoleInfo(selectedEvent.creator_role).color }}
        >
          <div className="event-type-icon">
            {getEventTypeInfo(selectedEvent.event_type).icon}
          </div>
          <div className="creator-role-badge">
            {getCreatorRoleInfo(selectedEvent.creator_role).icon} {getCreatorRoleInfo(selectedEvent.creator_role).label}
          </div>
          <button className="close-btn" onClick={() => setSelectedEvent(null)}>
            <X size={20} color="white" />
          </button>
        </div>
        <div className="modal-body">
          <h3>{selectedEvent.title}</h3>
          <span className="event-type-label" style={{ 
            backgroundColor: `${getEventTypeInfo(selectedEvent.event_type).color}20`,
            color: getEventTypeInfo(selectedEvent.event_type).color 
          }}>
            {getEventTypeInfo(selectedEvent.event_type).icon} {getEventTypeInfo(selectedEvent.event_type).label}
          </span>
          
          {/* Countdown Timer */}
          {(() => {
            const countdown = getCountdown(selectedEvent.start_date, selectedEvent.start_time);
            if (!countdown.expired) {
              return (
                <div className="countdown-display" style={{ backgroundColor: `${moduleColor}10` }}>
                  <Timer size={20} style={{ color: moduleColor }} />
                  <span>До события: <strong>{countdown.label}</strong></span>
                </div>
              );
            }
            return null;
          })()}
          
          {selectedEvent.description && (
            <p className="event-description">{selectedEvent.description}</p>
          )}
          
          <div className="event-info-list">
            <div className="info-item">
              <Calendar size={18} />
              <span>
                {new Date(selectedEvent.start_date).toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
                {selectedEvent.end_date && selectedEvent.end_date !== selectedEvent.start_date && (
                  ` - ${new Date(selectedEvent.end_date).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long'
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
            
            {selectedEvent.created_by && (
              <div className="info-item">
                <Users size={18} />
                <span>Организатор: {selectedEvent.created_by.first_name} {selectedEvent.created_by.last_name}</span>
              </div>
            )}
          </div>
          
          {/* Birthday Party Special Display */}
          {selectedEvent.event_type === 'BIRTHDAY' && selectedEvent.birthday_party_data && (
            <div 
              className="birthday-invitation-display"
              style={{
                background: selectedEvent.birthday_party_data.theme === 'PINK' 
                  ? 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 50%, #F9A8D4 100%)'
                  : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #93C5FD 100%)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                margin: '16px 0',
                border: `2px solid ${selectedEvent.birthday_party_data.theme === 'PINK' ? '#EC4899' : '#3B82F6'}`
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {selectedEvent.birthday_party_data.theme === 'PINK' ? '🎀🎂🎀' : '🎈🎂🎈'}
              </div>
              {selectedEvent.birthday_party_data.birthday_child_name && (
                <p style={{ 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: selectedEvent.birthday_party_data.theme === 'PINK' ? '#BE185D' : '#1D4ED8',
                  marginBottom: '8px'
                }}>
                  {selectedEvent.birthday_party_data.birthday_child_name}
                  {selectedEvent.birthday_party_data.birthday_child_age && 
                    ` исполняется ${selectedEvent.birthday_party_data.birthday_child_age}!`
                  }
                </p>
              )}
              {selectedEvent.birthday_party_data.custom_message && (
                <p style={{ 
                  fontStyle: 'italic',
                  color: selectedEvent.birthday_party_data.theme === 'PINK' ? '#9D174D' : '#1E40AF',
                  padding: '10px',
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: '8px'
                }}>
                  "{selectedEvent.birthday_party_data.custom_message}"
                </p>
              )}
              {selectedEvent.birthday_party_data.wish_list?.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ 
                    fontSize: '13px', 
                    color: selectedEvent.birthday_party_data.theme === 'PINK' ? '#BE185D' : '#1D4ED8',
                    marginBottom: '8px'
                  }}>
                    <Gift size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Список желаний:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                    {selectedEvent.birthday_party_data.wish_list.map((wish, idx) => (
                      <span 
                        key={idx}
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(255,255,255,0.8)',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: selectedEvent.birthday_party_data.theme === 'PINK' ? '#9D174D' : '#1E40AF'
                        }}
                      >
                        🎁 {wish}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* RSVP Section */}
          {selectedEvent.requires_rsvp && (
            <div className="rsvp-section">
              <h4>Подтверждение участия</h4>
              {selectedEvent.max_attendees && (
                <p className="attendees-limit">
                  Максимум участников: {selectedEvent.max_attendees}
                  {selectedEvent.rsvp_summary && ` (подтвердили: ${selectedEvent.rsvp_summary.YES || 0})`}
                </p>
              )}
              {renderRSVPButtons(selectedEvent, true)}
            </div>
          )}
          
          {/* Actions */}
          {(isTeacher || isAdmin || selectedEvent.created_by?.id === user?.id) && (
            <div className="modal-actions">
              <button 
                className="delete-btn"
                onClick={() => handleDeleteEvent(selectedEvent.id)}
              >
                <Trash2 size={16} /> Удалить событие
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCreateEventModal = () => (
    <div className="modal-overlay" onClick={() => { setShowCreateModal(false); resetEventForm(); }}>
      <div className="create-event-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ backgroundColor: moduleColor }}>
          <h3><Plus size={20} /> Новое событие</h3>
          <button className="close-btn" onClick={() => { setShowCreateModal(false); resetEventForm(); }}>
            <X size={20} color="white" />
          </button>
        </div>
        
        {/* Quick Presets */}
        <div className="event-presets">
          <button 
            className="presets-toggle"
            onClick={() => setShowPresets(!showPresets)}
          >
            <Gift size={16} />
            Готовые шаблоны
            <ChevronDown size={16} className={showPresets ? 'rotated' : ''} />
          </button>
          
          {showPresets && (
            <div className="presets-grid">
              {eventPresets.map((preset, idx) => (
                <button
                  key={idx}
                  className="preset-btn"
                  onClick={() => applyPreset(preset)}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>
          )}
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
                  onClick={() => {
                    setNewEvent(prev => ({ ...prev, event_type: type.value }));
                    // Show birthday form when BIRTHDAY type is selected
                    if (type.value === 'BIRTHDAY') {
                      setShowBirthdayForm(true);
                    } else {
                      setShowBirthdayForm(false);
                    }
                  }}
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
          
          {/* Birthday Party Form Section */}
          {newEvent.event_type === 'BIRTHDAY' && (
            <div className="birthday-party-section" style={{ 
              background: birthdayPartyData.theme === 'PINK' 
                ? 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)' 
                : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '16px',
              border: birthdayPartyData.theme === 'PINK' ? '2px solid #F9A8D4' : '2px solid #93C5FD'
            }}>
              <h4 style={{ 
                color: birthdayPartyData.theme === 'PINK' ? '#BE185D' : '#1D4ED8',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🎂 Настройки дня рождения
              </h4>
              
              {/* Theme Selector */}
              <div className="form-group">
                <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Тема приглашения
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setBirthdayPartyData(prev => ({ ...prev, theme: 'PINK' }))}
                    style={{
                      flex: 1,
                      padding: '16px',
                      borderRadius: '12px',
                      border: birthdayPartyData.theme === 'PINK' ? '3px solid #EC4899' : '2px solid #F9A8D4',
                      background: birthdayPartyData.theme === 'PINK' 
                        ? 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 100%)' 
                        : '#FDF2F8',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>🎀</span>
                    <span style={{ color: '#BE185D', fontWeight: '600' }}>Розовая тема</span>
                    <span style={{ fontSize: '12px', color: '#9D174D' }}>Для девочек</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBirthdayPartyData(prev => ({ ...prev, theme: 'BLUE' }))}
                    style={{
                      flex: 1,
                      padding: '16px',
                      borderRadius: '12px',
                      border: birthdayPartyData.theme === 'BLUE' ? '3px solid #3B82F6' : '2px solid #93C5FD',
                      background: birthdayPartyData.theme === 'BLUE' 
                        ? 'linear-gradient(135deg, #EFF6FF 0%, #BFDBFE 100%)' 
                        : '#EFF6FF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>🎈</span>
                    <span style={{ color: '#1D4ED8', fontWeight: '600' }}>Синяя тема</span>
                    <span style={{ fontSize: '12px', color: '#1E40AF' }}>Для мальчиков</span>
                  </button>
                </div>
              </div>
              
              {/* Birthday Child Info */}
              <div className="form-row" style={{ marginTop: '16px' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Имя именинника</label>
                  <input
                    type="text"
                    value={birthdayPartyData.birthday_child_name}
                    onChange={e => setBirthdayPartyData(prev => ({ ...prev, birthday_child_name: e.target.value }))}
                    placeholder="Например: Маша"
                    style={{ 
                      borderColor: birthdayPartyData.theme === 'PINK' ? '#F9A8D4' : '#93C5FD',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Исполняется лет</label>
                  <input
                    type="number"
                    value={birthdayPartyData.birthday_child_age || ''}
                    onChange={e => setBirthdayPartyData(prev => ({ ...prev, birthday_child_age: parseInt(e.target.value) || null }))}
                    placeholder="7"
                    min="1"
                    max="18"
                    style={{ 
                      borderColor: birthdayPartyData.theme === 'PINK' ? '#F9A8D4' : '#93C5FD',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
              </div>
              
              {/* Custom Message */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Персональное сообщение в приглашении</label>
                <textarea
                  value={birthdayPartyData.custom_message}
                  onChange={e => setBirthdayPartyData(prev => ({ ...prev, custom_message: e.target.value }))}
                  placeholder="Приглашаю тебя на мой день рождения! Будет весело! 🎉"
                  rows={3}
                  style={{ 
                    borderColor: birthdayPartyData.theme === 'PINK' ? '#F9A8D4' : '#93C5FD',
                    backgroundColor: 'white'
                  }}
                />
              </div>
              
              {/* Wish List (Placeholder) */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gift size={16} /> Список желаний 
                  <span style={{ 
                    fontSize: '11px', 
                    background: birthdayPartyData.theme === 'PINK' ? '#FDF2F8' : '#EFF6FF',
                    color: birthdayPartyData.theme === 'PINK' ? '#BE185D' : '#1D4ED8',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    Скоро: Маркетплейс
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={wishInput}
                    onChange={e => setWishInput(e.target.value)}
                    placeholder="Добавить желание..."
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addWish())}
                    style={{ 
                      flex: 1,
                      borderColor: birthdayPartyData.theme === 'PINK' ? '#F9A8D4' : '#93C5FD',
                      backgroundColor: 'white'
                    }}
                  />
                  <button
                    type="button"
                    onClick={addWish}
                    style={{
                      padding: '8px 16px',
                      background: birthdayPartyData.theme === 'PINK' ? '#EC4899' : '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {birthdayPartyData.wish_list.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {birthdayPartyData.wish_list.map((wish, index) => (
                      <span
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: 'white',
                          borderRadius: '20px',
                          border: `1px solid ${birthdayPartyData.theme === 'PINK' ? '#F9A8D4' : '#93C5FD'}`,
                          fontSize: '14px'
                        }}
                      >
                        🎁 {wish}
                        <button
                          type="button"
                          onClick={() => removeWish(index)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#9CA3AF',
                            padding: '0',
                            display: 'flex'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Classmate Selection */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} /> Пригласить одноклассников
                </label>
                {loadingClassmates ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                    Загрузка списка одноклассников...
                  </div>
                ) : classmates.length === 0 ? (
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    color: '#6B7280',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px dashed #D1D5DB'
                  }}>
                    <Users size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <p>Нет доступных одноклассников</p>
                  </div>
                ) : (
                  <div style={{ 
                    maxHeight: '200px', 
                    overflowY: 'auto', 
                    background: 'white',
                    borderRadius: '8px',
                    border: `1px solid ${birthdayPartyData.theme === 'PINK' ? '#F9A8D4' : '#93C5FD'}`
                  }}>
                    {classmates.map(classmate => (
                      <div
                        key={classmate.id}
                        onClick={() => toggleClassmateSelection(classmate)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #F3F4F6',
                          background: selectedClassmates.some(c => c.id === classmate.id) 
                            ? (birthdayPartyData.theme === 'PINK' ? '#FDF2F8' : '#EFF6FF')
                            : 'white',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: `2px solid ${selectedClassmates.some(c => c.id === classmate.id) 
                            ? (birthdayPartyData.theme === 'PINK' ? '#EC4899' : '#3B82F6')
                            : '#D1D5DB'}`,
                          background: selectedClassmates.some(c => c.id === classmate.id)
                            ? (birthdayPartyData.theme === 'PINK' ? '#EC4899' : '#3B82F6')
                            : 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {selectedClassmates.some(c => c.id === classmate.id) && (
                            <Check size={14} color="white" />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500' }}>{classmate.full_name}</div>
                          {classmate.assigned_class && (
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              Класс: {classmate.assigned_class}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedClassmates.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#6B7280' }}>
                    Выбрано: {selectedClassmates.length} {selectedClassmates.length === 1 ? 'гость' : 
                      selectedClassmates.length < 5 ? 'гостя' : 'гостей'}
                  </div>
                )}
              </div>
              
              {/* Invitation Preview */}
              <div className="form-group" style={{ marginTop: '20px' }}>
                <label>Предпросмотр приглашения</label>
                <div style={{
                  background: birthdayPartyData.theme === 'PINK' 
                    ? 'linear-gradient(135deg, #FDF2F8 0%, #FBCFE8 50%, #F9A8D4 100%)'
                    : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #93C5FD 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  textAlign: 'center',
                  border: `3px solid ${birthdayPartyData.theme === 'PINK' ? '#EC4899' : '#3B82F6'}`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                    {birthdayPartyData.theme === 'PINK' ? '🎀🎂🎀' : '🎈🎂🎈'}
                  </div>
                  <h3 style={{ 
                    color: birthdayPartyData.theme === 'PINK' ? '#BE185D' : '#1D4ED8',
                    fontSize: '22px',
                    marginBottom: '8px'
                  }}>
                    {newEvent.title || 'День рождения'}
                  </h3>
                  {birthdayPartyData.birthday_child_name && (
                    <p style={{ 
                      fontSize: '18px', 
                      color: birthdayPartyData.theme === 'PINK' ? '#9D174D' : '#1E40AF',
                      marginBottom: '8px'
                    }}>
                      {birthdayPartyData.birthday_child_name} 
                      {birthdayPartyData.birthday_child_age && ` исполняется ${birthdayPartyData.birthday_child_age}!`}
                    </p>
                  )}
                  {birthdayPartyData.custom_message && (
                    <p style={{ 
                      fontStyle: 'italic', 
                      color: birthdayPartyData.theme === 'PINK' ? '#BE185D' : '#1D4ED8',
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.5)',
                      borderRadius: '8px'
                    }}>
                      "{birthdayPartyData.custom_message}"
                    </p>
                  )}
                  <div style={{ 
                    marginTop: '16px', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    {newEvent.start_date && (
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        color: birthdayPartyData.theme === 'PINK' ? '#9D174D' : '#1E40AF',
                        fontSize: '14px'
                      }}>
                        <Calendar size={16} />
                        {new Date(newEvent.start_date).toLocaleDateString('ru-RU', { 
                          day: 'numeric', 
                          month: 'long' 
                        })}
                      </span>
                    )}
                    {newEvent.start_time && (
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        color: birthdayPartyData.theme === 'PINK' ? '#9D174D' : '#1E40AF',
                        fontSize: '14px'
                      }}>
                        <Clock size={16} />
                        {newEvent.start_time}
                      </span>
                    )}
                    {newEvent.location && (
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        color: birthdayPartyData.theme === 'PINK' ? '#9D174D' : '#1E40AF',
                        fontSize: '14px'
                      }}>
                        <MapPin size={16} />
                        {newEvent.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
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
          
          {/* RSVP Options */}
          <div className="rsvp-options">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={newEvent.requires_rsvp}
                  onChange={e => setNewEvent(prev => ({ ...prev, requires_rsvp: e.target.checked }))}
                />
                <span>Требуется подтверждение участия (RSVP)</span>
              </label>
            </div>
            
            {newEvent.requires_rsvp && (
              <div className="form-group">
                <label>Максимум участников (необязательно)</label>
                <input
                  type="number"
                  value={newEvent.max_attendees || ''}
                  onChange={e => setNewEvent(prev => ({ ...prev, max_attendees: e.target.value }))}
                  placeholder="Без ограничений"
                  min="1"
                />
              </div>
            )}
          </div>
          
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => { setShowCreateModal(false); resetEventForm(); }}>
              Отмена
            </button>
            <button type="submit" className="submit-btn" style={{ backgroundColor: moduleColor }}>
              Создать событие
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="event-planner" style={{ '--module-color': moduleColor }}>
      {/* Header */}
      <div className="planner-header">
        <div className="planner-title">
          <Calendar size={28} style={{ color: moduleColor }} />
          <div>
            <h2>Планировщик событий</h2>
            <p>Календарь школьных мероприятий</p>
          </div>
        </div>
        
        <div className="planner-controls">
          {/* View Toggle */}
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
              style={{ backgroundColor: viewMode === 'month' ? moduleColor : undefined }}
            >
              <Calendar size={16} /> Календарь
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ backgroundColor: viewMode === 'list' ? moduleColor : undefined }}
            >
              <FileText size={16} /> Список
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
          
          {/* Create Button */}
          {canCreateEvents && (
            <button 
              className="create-btn"
              onClick={() => {
                setNewEvent(prev => ({ ...prev, start_date: selectedDate || today }));
                setShowCreateModal(true);
              }}
              style={{ backgroundColor: moduleColor }}
            >
              <Plus size={18} />
              <span>Создать событие</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Color Legend */}
      <div className="role-legend">
        <span className="legend-title">По организатору:</span>
        {Object.entries(CREATOR_ROLES).map(([key, role]) => (
          <span key={key} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: role.color }}></span>
            {role.icon} {role.label}
          </span>
        ))}
      </div>

      {/* Main Content */}
      <div className="planner-content">
        {/* Calendar/List View */}
        <div className="planner-main">
          {viewMode === 'month' ? (
            <div className="calendar-month-view">
              <div className="calendar-weekdays">
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="weekday">{day}</div>
                ))}
              </div>
              
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
                          <span className="day-number" style={{ 
                            color: isToday ? 'white' : undefined,
                            backgroundColor: isToday ? moduleColor : undefined
                          }}>
                            {dayInfo.day}
                          </span>
                          <div className="day-events">
                            {dayEvents.slice(0, 3).map(event => {
                              const roleInfo = getCreatorRoleInfo(event.creator_role);
                              return (
                                <div 
                                  key={event.id}
                                  className="event-dot"
                                  style={{ backgroundColor: event.role_color || roleInfo.color }}
                                  title={`${event.title} (${roleInfo.label})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEvent(event);
                                  }}
                                >
                                  <span className="event-dot-title">{event.title}</span>
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
              ) : sortedEvents.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={64} style={{ color: '#D1D5DB' }} />
                  <h3>Нет событий</h3>
                  <p>В этом месяце нет запланированных событий</p>
                </div>
              ) : (
                <div className="events-list">
                  {sortedEvents.map(event => {
                    const typeInfo = getEventTypeInfo(event.event_type);
                    const roleInfo = getCreatorRoleInfo(event.creator_role);
                    const countdown = getCountdown(event.start_date, event.start_time);
                    
                    return (
                      <div 
                        key={event.id} 
                        className="event-list-item"
                        onClick={() => setSelectedEvent(event)}
                        style={{ borderLeftColor: event.role_color || roleInfo.color }}
                      >
                        <div className="event-date-badge" style={{ backgroundColor: event.role_color || roleInfo.color }}>
                          <span className="event-day">{new Date(event.start_date).getDate()}</span>
                          <span className="event-month">{MONTHS[new Date(event.start_date).getMonth()].slice(0, 3)}</span>
                        </div>
                        
                        <div className="event-details">
                          <div className="event-header-row">
                            <h4>
                              <span className="event-icon">{typeInfo.icon}</span>
                              {event.title}
                            </h4>
                            <div className="event-badges">
                              {event.requires_rsvp && (
                                <span className="rsvp-badge">
                                  <UserCheck size={14} /> RSVP
                                </span>
                              )}
                              <span 
                                className="role-badge"
                                style={{ backgroundColor: `${event.role_color || roleInfo.color}20`, color: event.role_color || roleInfo.color }}
                              >
                                {roleInfo.icon} {roleInfo.label}
                              </span>
                            </div>
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
                            {!countdown.expired && (
                              <span className="countdown-badge" style={{ color: moduleColor }}>
                                <Timer size={14} />
                                Через {countdown.label}
                              </span>
                            )}
                          </div>
                          
                          {/* RSVP inline */}
                          {event.requires_rsvp && renderRSVPButtons(event)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Events Sidebar */}
        <div className="upcoming-sidebar">
          <h3><Bell size={18} /> Ближайшие события</h3>
          
          {upcomingEvents.length === 0 ? (
            <div className="sidebar-empty">
              <p>Нет предстоящих событий</p>
            </div>
          ) : (
            <div className="upcoming-list">
              {upcomingEvents.map(event => {
                const typeInfo = getEventTypeInfo(event.event_type);
                const roleInfo = getCreatorRoleInfo(event.creator_role);
                const countdown = getCountdown(event.start_date, event.start_time);
                
                return (
                  <div 
                    key={event.id}
                    className="upcoming-item"
                    onClick={() => setSelectedEvent(event)}
                    style={{ borderLeftColor: event.role_color || roleInfo.color }}
                  >
                    <div className="upcoming-icon" style={{ backgroundColor: `${typeInfo.color}20` }}>
                      {typeInfo.icon}
                    </div>
                    <div className="upcoming-info">
                      <h4>{event.title}</h4>
                      <span className="date">
                        {new Date(event.start_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="countdown-timer" style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}>
                      <Timer size={14} />
                      <span>{countdown.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedEvent && renderEventDetailModal()}
      {showCreateModal && renderCreateEventModal()}
    </div>
  );
};

export default EventPlanner;
