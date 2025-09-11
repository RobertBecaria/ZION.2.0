import React from 'react';
import { MessageSquare, Users, Calendar } from 'lucide-react';

function ContentNavigation({ 
  activeView, 
  onViewChange, 
  moduleColor = "#059669",
  moduleName = "Family",
  showCalendar = false,
  onCalendarToggle 
}) {
  const views = [
    {
      key: 'wall',
      name: 'Стена',
      icon: Users,
      description: 'Публикации и новости'
    },
    {
      key: 'chat',
      name: 'Чат',
      icon: MessageSquare,
      description: 'Общение и сообщения'
    }
  ];

  return (
    <div className="content-navigation">
      <div className="nav-tabs">
        {views.map((view) => {
          const IconComponent = view.icon;
          return (
            <button
              key={view.key}
              className={`nav-tab ${activeView === view.key ? 'active' : ''}`}
              onClick={() => onViewChange(view.key)}
              style={{
                borderBottomColor: activeView === view.key ? moduleColor : 'transparent',
                color: activeView === view.key ? moduleColor : undefined
              }}
            >
              <IconComponent size={18} />
              <span>{view.name}</span>
            </button>
          );
        })}
      </div>

      <div className="nav-actions">
        <button 
          className={`calendar-toggle-btn ${showCalendar ? 'active' : ''}`}
          onClick={onCalendarToggle}
          title="Открыть календарь"
          style={{ 
            backgroundColor: showCalendar ? moduleColor : undefined,
            color: showCalendar ? 'white' : moduleColor
          }}
        >
          <Calendar size={18} />
        </button>
      </div>
    </div>
  );
}

export default ContentNavigation;