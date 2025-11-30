import React from 'react';
import { GraduationCap, Users, Calendar, BookOpen, MessageCircle, Home, Filter, Building2, ChevronRight } from 'lucide-react';

const JournalWorldZone = ({ 
  selectedSchool, 
  role, 
  onNavigate,
  // Feed filter props
  inFeedView = false,
  schoolRoles = null,
  schoolFilter = 'all',
  onSchoolFilterChange = () => {},
  audienceFilter = 'all',
  onAudienceFilterChange = () => {},
  onOpenEventPlanner = null
}) => {
  
  const moduleColor = '#6D28D9';

  const AUDIENCE_OPTIONS = [
    { value: 'all', label: 'Все посты', icon: '📰' },
    { value: 'PUBLIC', label: 'Публичные', icon: '🌍' },
    { value: 'TEACHERS', label: 'Для учителей', icon: '👨‍🏫' },
    { value: 'PARENTS', label: 'Для родителей', icon: '👨‍👩‍👧' },
    { value: 'STUDENTS_PARENTS', label: 'Для учеников', icon: '📚' }
  ];

  const getAllSchools = () => {
    const schools = [];
    if (schoolRoles) {
      if (schoolRoles.schools_as_teacher) {
        schools.push(...schoolRoles.schools_as_teacher.map(s => ({ ...s, role: 'teacher' })));
      }
      if (schoolRoles.schools_as_parent) {
        schools.push(...schoolRoles.schools_as_parent.map(s => ({ ...s, role: 'parent' })));
      }
    }
    return Array.from(new Map(schools.map(s => [s.organization_id, s])).values());
  };

  // Show Feed Filters when in feed view
  if (inFeedView) {
    const schools = getAllSchools();
    
    return (
      <div className="journal-world-zone feed-filters-zone">
        {/* Post Filters Card */}
        <div className="world-zone-card filter-card">
          <div className="card-header" style={{ borderBottomColor: `${moduleColor}30` }}>
            <Filter size={20} style={{ color: moduleColor }} />
            <h3>ФИЛЬТР ПОСТОВ</h3>
          </div>
          
          <div className="filter-content">
            {/* School Filter */}
            <div className="filter-group">
              <label className="filter-label">
                <Building2 size={16} />
                <span>По школе</span>
              </label>
              <select 
                value={schoolFilter}
                onChange={(e) => onSchoolFilterChange(e.target.value)}
                className="filter-select"
                style={{ borderColor: moduleColor }}
              >
                <option value="all">Все школы</option>
                {schools.map(school => (
                  <option key={school.organization_id} value={school.organization_id}>
                    {school.organization_name} ({school.role === 'teacher' ? 'Учитель' : 'Родитель'})
                  </option>
                ))}
              </select>
            </div>

            {/* Audience Filter */}
            <div className="filter-group">
              <label className="filter-label">
                <Users size={16} />
                <span>По аудитории</span>
              </label>
              <div className="filter-buttons">
                {AUDIENCE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    className={`filter-btn ${audienceFilter === option.value ? 'active' : ''}`}
                    onClick={() => onAudienceFilterChange(option.value)}
                    style={{
                      backgroundColor: audienceFilter === option.value ? moduleColor : 'transparent',
                      borderColor: audienceFilter === option.value ? moduleColor : '#E5E7EB',
                      color: audienceFilter === option.value ? 'white' : '#6B7280'
                    }}
                  >
                    <span className="filter-btn-icon">{option.icon}</span>
                    <span className="filter-btn-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Card */}
        {schools.length > 0 && (
          <div className="world-zone-card stats-card">
            <div className="card-header" style={{ borderBottomColor: `${moduleColor}30` }}>
              <GraduationCap size={20} style={{ color: moduleColor }} />
              <h3>МОИ ШКОЛЫ</h3>
            </div>
            <div className="schools-quick-list">
              {schools.map(school => (
                <div 
                  key={school.organization_id} 
                  className={`school-quick-item ${schoolFilter === school.organization_id ? 'active' : ''}`}
                  onClick={() => onSchoolFilterChange(school.organization_id)}
                  style={{
                    borderLeftColor: schoolFilter === school.organization_id ? moduleColor : 'transparent'
                  }}
                >
                  <div className="school-quick-name">{school.organization_name}</div>
                  <span 
                    className="school-quick-role"
                    style={{
                      backgroundColor: school.role === 'teacher' ? '#2563EB15' : '#05966915',
                      color: school.role === 'teacher' ? '#2563EB' : '#059669'
                    }}
                  >
                    {school.role === 'teacher' ? 'Учитель' : 'Родитель'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Original school-selected view
  if (!selectedSchool) {
    return null;
  }

  const parentNavigationItems = [
    { 
      key: 'children', 
      icon: Users, 
      label: 'Мои Дети', 
      description: 'Информация о детях' 
    },
    { 
      key: 'schedule', 
      icon: Calendar, 
      label: 'Расписание', 
      description: 'Расписание уроков' 
    },
    { 
      key: 'journal', 
      icon: BookOpen, 
      label: 'Электронный Дневник', 
      description: 'Оценки и успеваемость' 
    },
    { 
      key: 'calendar', 
      icon: Calendar, 
      label: 'Календарь', 
      description: 'Академический календарь' 
    },
    { 
      key: 'messages', 
      icon: MessageCircle, 
      label: 'Сообщения', 
      description: 'Связь с учителями' 
    }
  ];

  const teacherNavigationItems = [
    { 
      key: 'classes', 
      icon: Users, 
      label: 'Мои Классы', 
      description: 'Список классов' 
    },
    { 
      key: 'schedule', 
      icon: Calendar, 
      label: 'Расписание', 
      description: 'Расписание уроков' 
    },
    { 
      key: 'gradebook', 
      icon: BookOpen, 
      label: 'Журнал Оценок', 
      description: 'Выставление оценок' 
    },
    { 
      key: 'students', 
      icon: Users, 
      label: 'Ученики', 
      description: 'Список учеников' 
    },
    { 
      key: 'calendar', 
      icon: Calendar, 
      label: 'Календарь', 
      description: 'Академический календарь' 
    }
  ];

  const navigationItems = role === 'parent' ? parentNavigationItems : teacherNavigationItems;

  return (
    <div className="journal-world-zone">
      {/* Selected School Card */}
      <div className="world-zone-card school-info-card">
        <div className="card-header">
          <GraduationCap size={20} />
          <h3>Выбранная Школа</h3>
        </div>
        <div className="school-info-content">
          <div className="school-name">{selectedSchool.organization_name}</div>
          {role === 'parent' && (
            <div className="school-meta">
              <Users size={16} />
              <span>{selectedSchool.children_count} {
                selectedSchool.children_count === 1 ? 'ребёнок' : 
                selectedSchool.children_count > 4 ? 'детей' : 'ребёнка'
              }</span>
            </div>
          )}
          {role === 'teacher' && selectedSchool.teaching_subjects && (
            <div className="school-meta">
              <BookOpen size={16} />
              <span>{selectedSchool.teaching_subjects.join(', ')}</span>
            </div>
          )}
        </div>
        <button 
          className="btn-link"
          onClick={() => onNavigate('school-list')}
        >
          <Home size={16} />
          Сменить школу
        </button>
      </div>

      {/* Navigation Menu */}
      <div className="world-zone-card navigation-menu-card">
        <div className="card-header">
          <BookOpen size={20} />
          <h3>Навигация</h3>
        </div>
        <div className="navigation-menu">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.key}
                className="navigation-item"
                onClick={() => onNavigate(item.key)}
              >
                <div className="nav-item-icon">
                  <IconComponent size={18} />
                </div>
                <div className="nav-item-text">
                  <div className="nav-item-label">{item.label}</div>
                  <div className="nav-item-description">{item.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Info Widget */}
      {role === 'parent' && selectedSchool.children_count > 0 && (
        <div className="world-zone-card quick-info-card">
          <div className="card-header">
            <Users size={20} />
            <h3>Дети в Этой Школе</h3>
          </div>
          <div className="children-quick-list">
            <p className="quick-info-text">
              У вас {selectedSchool.children_count} {
                selectedSchool.children_count === 1 ? 'ребёнок учится' : 
                selectedSchool.children_count > 4 ? 'детей учатся' : 'ребёнка учатся'
              } в этой школе
            </p>
          </div>
        </div>
      )}

      {role === 'teacher' && selectedSchool.is_class_supervisor && (
        <div className="world-zone-card quick-info-card">
          <div className="card-header">
            <Users size={20} />
            <h3>Классное Руководство</h3>
          </div>
          <div className="supervisor-info">
            <p className="quick-info-text">
              Вы классный руководитель класса <strong>{selectedSchool.supervised_class}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalWorldZone;
