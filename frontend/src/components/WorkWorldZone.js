/**
 * WorkWorldZone Component
 * Right sidebar for Organizations section with filters and quick actions
 * Similar to JournalWorldZone
 */
import React from 'react';
import { 
  Building2, Filter, Users, Calendar, CheckCircle2, 
  ChevronRight, Briefcase, Settings, Bell
} from 'lucide-react';

const WorkWorldZone = ({ 
  organizations = [],
  selectedOrg,
  onOrgChange,
  onNavigate,
  moduleColor = '#C2410C',
  // Task-related
  taskStats = { total: 0, completed: 0, overdue: 0 }
}) => {
  
  const QUICK_FILTERS = [
    { value: 'all', label: 'Все посты', icon: '📰' },
    { value: 'announcements', label: 'Объявления', icon: '📢' },
    { value: 'tasks', label: 'Задачи', icon: '✅' },
    { value: 'events', label: 'События', icon: '📅' }
  ];

  return (
    <div className="work-world-zone" style={{ '--module-color': moduleColor }}>
      {/* Organization Filter Card */}
      <div className="world-zone-card filter-card">
        <div className="card-header" style={{ borderBottomColor: `${moduleColor}30` }}>
          <Filter size={20} style={{ color: moduleColor }} />
          <h3>ФИЛЬТРЫ</h3>
        </div>
        
        <div className="filter-content">
          {/* Organization Filter */}
          <div className="filter-group">
            <label className="filter-label">
              <Building2 size={16} />
              <span>Организация</span>
            </label>
            <select 
              value={selectedOrg || 'all'}
              onChange={(e) => onOrgChange(e.target.value === 'all' ? null : e.target.value)}
              className="filter-select"
              style={{ borderColor: moduleColor }}
            >
              <option value="all">Все организации</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* My Organizations Quick List */}
      {organizations.length > 0 && (
        <div className="world-zone-card orgs-card">
          <div className="card-header" style={{ borderBottomColor: `${moduleColor}30` }}>
            <Building2 size={20} style={{ color: moduleColor }} />
            <h3>МОИ ОРГАНИЗАЦИИ</h3>
          </div>
          <div className="orgs-quick-list">
            {organizations.slice(0, 5).map(org => (
              <div 
                key={org.id} 
                className={`org-quick-item ${selectedOrg === org.id ? 'active' : ''}`}
                onClick={() => onOrgChange(org.id)}
                style={{
                  borderLeftColor: selectedOrg === org.id ? moduleColor : 'transparent'
                }}
              >
                <div 
                  className="org-quick-avatar"
                  style={{ background: `linear-gradient(135deg, ${moduleColor}, ${moduleColor}cc)` }}
                >
                  {org.name.charAt(0)}
                </div>
                <div className="org-quick-info">
                  <div className="org-quick-name">{org.name}</div>
                  {org.role && (
                    <div className="org-quick-role">{org.role}</div>
                  )}
                </div>
                <ChevronRight size={16} className="org-quick-arrow" />
              </div>
            ))}
          </div>
          {organizations.length > 5 && (
            <button 
              className="view-all-btn"
              onClick={() => onNavigate && onNavigate('organizations')}
              style={{ color: moduleColor }}
            >
              Показать все ({organizations.length})
            </button>
          )}
        </div>
      )}

      {/* Task Stats Card */}
      {taskStats.total > 0 && (
        <div className="world-zone-card stats-card">
          <div className="card-header" style={{ borderBottomColor: `${moduleColor}30` }}>
            <CheckCircle2 size={20} style={{ color: moduleColor }} />
            <h3>СТАТИСТИКА ЗАДАЧ</h3>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value" style={{ color: moduleColor }}>{taskStats.total}</span>
              <span className="stat-label">Всего</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: '#22c55e' }}>{taskStats.completed}</span>
              <span className="stat-label">Выполнено</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: '#dc2626' }}>{taskStats.overdue}</span>
              <span className="stat-label">Просрочено</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="world-zone-card actions-card">
        <div className="card-header" style={{ borderBottomColor: `${moduleColor}30` }}>
          <Briefcase size={20} style={{ color: moduleColor }} />
          <h3>БЫСТРЫЕ ДЕЙСТВИЯ</h3>
        </div>
        <div className="quick-actions">
          <button 
            className="quick-action-btn"
            onClick={() => onNavigate && onNavigate('create-org')}
          >
            <Building2 size={18} />
            <span>Создать организацию</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => onNavigate && onNavigate('find-org')}
          >
            <Users size={18} />
            <span>Найти организацию</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => onNavigate && onNavigate('notifications')}
          >
            <Bell size={18} />
            <span>Уведомления</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkWorldZone;
