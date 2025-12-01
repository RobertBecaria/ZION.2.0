/**
 * EventPlanner Utility Functions
 * Helper functions for event planning features
 */
import { EVENT_TYPES, CREATOR_ROLES, MONTHS } from './constants';

/**
 * Get event type info by type value
 */
export const getEventTypeInfo = (type) => {
  return EVENT_TYPES.find(t => t.value === type) || { icon: '📅', label: type, color: '#6B7280' };
};

/**
 * Get creator role info
 */
export const getCreatorRoleInfo = (role) => {
  return CREATOR_ROLES[role] || { label: 'Неизвестно', color: '#6B7280', icon: '👤' };
};

/**
 * Get countdown to event
 */
export const getCountdown = (eventDate, eventTime) => {
  const now = new Date();
  const eventDateTime = new Date(eventDate);
  
  if (eventTime) {
    const [hours, minutes] = eventTime.split(':');
    eventDateTime.setHours(parseInt(hours), parseInt(minutes));
  }
  
  const diff = eventDateTime - now;
  
  if (diff < 0) {
    return { expired: true, label: 'Прошло' };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return { 
      expired: false, 
      label: `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`,
      days, hours, minutes 
    };
  } else if (hours > 0) {
    return { 
      expired: false, 
      label: `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`,
      days, hours, minutes 
    };
  } else {
    return { 
      expired: false, 
      label: `${minutes} ${minutes === 1 ? 'минута' : minutes < 5 ? 'минуты' : 'минут'}`,
      days, hours, minutes 
    };
  }
};

/**
 * Format date for display
 */
export const formatDate = (dateString, options = {}) => {
  const date = new Date(dateString);
  const defaultOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  };
  return date.toLocaleDateString('ru-RU', { ...defaultOptions, ...options });
};

/**
 * Get month name
 */
export const getMonthName = (month) => MONTHS[month];

/**
 * Get calendar days for a month
 */
export const getCalendarDays = (currentDate) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  
  const days = [];
  
  // Previous month's days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      day: prevMonthLastDay - i,
      isCurrentMonth: false,
      date: new Date(year, month - 1, prevMonthLastDay - i)
    });
  }
  
  // Current month's days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({
      day: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
      isToday: new Date().toDateString() === new Date(year, month, i).toDateString()
    });
  }
  
  // Next month's days
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i)
    });
  }
  
  return days;
};

/**
 * Get events for a specific date
 */
export const getEventsForDate = (events, date) => {
  const dateString = date.toISOString().split('T')[0];
  return events.filter(event => event.start_date === dateString);
};

/**
 * Get upcoming events sorted by date
 */
export const getUpcomingEvents = (events, limit = 5) => {
  const today = new Date().toISOString().split('T')[0];
  return events
    .filter(event => event.start_date >= today)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, limit);
};
