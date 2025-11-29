/**
 * ModuleNavigation Component
 * Top navigation bar with module selection buttons
 */
import React from 'react';
import { User, Calendar } from 'lucide-react';
import { MODULES, MODULE_DEFAULT_VIEWS } from '../../config/moduleConfig';

const ModuleNavigation = ({ 
  activeModule, 
  setActiveModule, 
  setActiveView,
  user,
  onLogout,
  currentTime,
  showCalendar,
  setShowCalendar,
  setShowOnboarding
}) => {
  const currentModule = MODULES.find(m => m.key === activeModule) || MODULES[0];

  const handleModuleClick = (moduleKey) => {
    setActiveModule(moduleKey);
    setActiveView(MODULE_DEFAULT_VIEWS[moduleKey] || 'wall');
  };

  return (
    <nav className="top-nav" style={{ color: currentModule.color }}>
      <div className="nav-content">
        <div className="logo-section">
          <img src="/zion-logo.jpeg" alt="ZION.CITY Logo" className="nav-logo" />
          <h1 className="platform-logo">ZION.CITY</h1>
        </div>
        
        <div className="module-navigation">
          {MODULES.map((module) => (
            <button
              key={module.key}
              className={`nav-module ${activeModule === module.key ? 'active' : ''}`}
              onClick={() => handleModuleClick(module.key)}
              style={{
                color: activeModule === module.key ? 'white' : module.color,
                backgroundColor: activeModule === module.key ? module.color : undefined,
                borderColor: `${module.color}20`
              }}
            >
              {module.name}
            </button>
          ))}
        </div>

        <div className="user-section">
          <div 
            className="clock-widget clickable" 
            onClick={() => setShowCalendar(!showCalendar)}
            title="Открыть календарь"
          >
            <div className="time">
              {currentTime.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
            <div className="date">
              {currentTime.toLocaleDateString('ru-RU', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </div>
            <div className="calendar-icon">
              <Calendar size={16} />
            </div>
          </div>
          <div className="user-menu">
            <button className="user-button">
              <User size={20} />
              <span>{user?.first_name}</span>
            </button>
            <div className="user-dropdown">
              <button onClick={() => setShowOnboarding(true)}>Настройки профиля</button>
              <button onClick={onLogout}>Выйти</button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default ModuleNavigation;
