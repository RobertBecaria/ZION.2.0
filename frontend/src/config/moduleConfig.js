/**
 * Module Configuration
 * Centralized configuration for all application modules
 */

export const MODULES = [
  { key: 'family', name: 'Семья', color: '#30A67E', icon: 'Users' },
  { key: 'news', name: 'Новости', color: '#1D4ED8', icon: 'Newspaper' },
  { key: 'journal', name: 'Журнал', color: '#6D28D9', icon: 'Book' },
  { key: 'services', name: 'Сервисы', color: '#B91C1C', icon: 'Grid' },
  { key: 'organizations', name: 'Организации', color: '#C2410C', icon: 'Building2' },
  { key: 'marketplace', name: 'Вещи', color: '#BE185D', icon: 'Package' },
  { key: 'finance', name: 'Финансы', color: '#A16207', icon: 'DollarSign' },
  { key: 'events', name: 'Добрая Воля', color: '#8B5CF6', icon: 'Heart' }
];

export const getModuleByKey = (key) => {
  return MODULES.find(m => m.key === key) || MODULES[0];
};

export const getModuleColor = (key) => {
  const module = getModuleByKey(key);
  return module.color;
};

/**
 * Generate sidebar tint style based on module color
 */
export const getSidebarTintStyle = (moduleColor) => ({
  background: `linear-gradient(135deg, ${moduleColor}18 0%, ${moduleColor}0A 50%, ${moduleColor}15 100%)`,
  borderColor: `${moduleColor}25`,
  color: moduleColor,
});

/**
 * Default views for each module when switching
 */
export const MODULE_DEFAULT_VIEWS = {
  family: 'wall',
  news: 'wall',
  journal: 'wall',
  services: 'services-search',
  organizations: 'my-work',
  marketplace: 'marketplace-search',
  finance: 'wallet',
  events: 'goodwill-search'
};

/**
 * Journal audience options
 */
export const JOURNAL_AUDIENCE_OPTIONS = [
  { value: 'PUBLIC', label: '🌍 Публично (все)', icon: '🌍' },
  { value: 'TEACHERS', label: '👨‍🏫 Только учителя', icon: '👨‍🏫' },
  { value: 'PARENTS', label: '👨‍👩‍👧 Только родители', icon: '👨‍👩‍👧' },
  { value: 'STUDENTS_PARENTS', label: '📚 Ученики и родители', icon: '📚' }
];

/**
 * Family post visibility options
 */
export const FAMILY_VISIBILITY_OPTIONS = [
  { value: 'FAMILY_ONLY', label: '🔒 Только моя семья', icon: '🔒' },
  { value: 'HOUSEHOLD_ONLY', label: '🏠 Только домохозяйство', icon: '🏠' },
  { value: 'PUBLIC', label: '🌍 Публично', icon: '🌍' },
  { value: 'ONLY_ME', label: '👤 Только я', icon: '👤' },
  { value: 'GENDER_MALE', label: '♂️ Только мужчины', icon: '♂️' },
  { value: 'GENDER_FEMALE', label: '♀️ Только женщины', icon: '♀️' },
  { value: 'GENDER_IT', label: '🤖 IT/AI', icon: '🤖' }
];

/**
 * Family filter options for World Zone
 */
export const FAMILY_FILTER_OPTIONS = [
  { id: 'all', label: 'Все посты', icon: '👁️', description: 'Показать все' },
  { id: 'public', label: 'Публичные', icon: '🌍', description: 'Общедоступные' },
  { id: 'my-family', label: 'Моя семья', icon: '🔒', description: 'Только семья' },
  { id: 'subscribed', label: 'Подписки', icon: '👥', description: 'Подписанные семьи' },
  { id: 'household', label: 'Домохозяйство', icon: '🏠', description: 'Мой дом' },
  { id: 'gender-male', label: 'Мужчины', icon: '♂️', description: 'Только для мужчин' },
  { id: 'gender-female', label: 'Женщины', icon: '♀️', description: 'Только для женщин' },
  { id: 'gender-it', label: 'IT/AI', icon: '🤖', description: 'Технологии' }
];

/**
 * Journal audience filter options for World Zone
 */
export const JOURNAL_FILTER_OPTIONS = [
  { value: 'all', label: 'Все посты', icon: '📰' },
  { value: 'PUBLIC', label: 'Публичные', icon: '🌍' },
  { value: 'TEACHERS', label: 'Для учителей', icon: '👨‍🏫' },
  { value: 'PARENTS', label: 'Для родителей', icon: '👨‍👩‍👧' },
  { value: 'STUDENTS_PARENTS', label: 'Для учеников', icon: '📚' }
];

export default {
  MODULES,
  getModuleByKey,
  getModuleColor,
  getSidebarTintStyle,
  MODULE_DEFAULT_VIEWS,
  JOURNAL_AUDIENCE_OPTIONS,
  FAMILY_VISIBILITY_OPTIONS,
  FAMILY_FILTER_OPTIONS,
  JOURNAL_FILTER_OPTIONS
};
