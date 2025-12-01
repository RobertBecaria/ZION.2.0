/**
 * EventPlanner Constants
 * Shared constants and configurations for the event planner system
 */

// Event type configurations
export const EVENT_TYPES = [
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
export const CREATOR_ROLES = {
  ADMIN: { label: 'Администрация', color: '#DC2626', icon: '🏫' },
  TEACHER: { label: 'Учитель', color: '#2563EB', icon: '👨‍🏫' },
  PARENT: { label: 'Родитель', color: '#16A34A', icon: '👨‍👩‍👧' },
  STUDENT: { label: 'Ученик', color: '#EAB308', icon: '👧' }
};

export const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Quick event templates
export const QUICK_PRESETS = [
  { label: 'День рождения', event_type: 'BIRTHDAY', requires_rsvp: true, icon: '🎂' },
  { label: 'Родительское собрание', event_type: 'MEETING', requires_rsvp: true, icon: '👥' },
  { label: 'Своё событие', event_type: 'EVENT', requires_rsvp: false, icon: '📝' }
];
