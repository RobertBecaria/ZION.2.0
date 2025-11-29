/**
 * ModuleNavigation Component
 * Top navigation bar with module selection buttons
 */
import React from 'react';
import { MODULES, MODULE_DEFAULT_VIEWS } from '../config/moduleConfig';

const ModuleNavigation = ({ 
  activeModule, 
  setActiveModule, 
  setActiveView,
  user,
  onLogout,
  currentTime 
}) => {
  const currentModule = MODULES.find(m => m.key === activeModule) || MODULES[0];

  const handleModuleClick = (moduleKey) => {
    setActiveModule(moduleKey);
    setActiveView(MODULE_DEFAULT_VIEWS[moduleKey] || 'wall');
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
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

        <div className="nav-right">
          <div className="time-display" style={{ color: currentModule.color }}>
            <span className="current-date">{formatDate(currentTime)}</span>
            <span className="current-time">{formatTime(currentTime)}</span>
          </div>
          
          {user && (
            <div className="nav-profile">
              <span className="nav-user-name">{user.first_name}</span>
              <button 
                className="nav-btn logout-btn" 
                onClick={onLogout}
                title="Выйти"
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default ModuleNavigation;
