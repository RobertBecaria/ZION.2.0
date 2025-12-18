import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, Clock, MapPin, Users, User,
  CheckCircle, AlertCircle, Video, Heart, Filter
} from 'lucide-react';

function EnhancedEventsPanel({ 
  activeGroup, 
  moduleColor = "#059669",
  moduleName = "Family",
  user,
  context = "wall"
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  // Mock events data based on the screenshot
  const mockEvents = [
    {
      id: '1',
      title: 'Вебинар по цифровой грамотности',
      description: 'Сейчас идёт',
      type: 'webinar',
      color: '#10b981',
      icon: Video,
      action: 'Присоединиться',
      actionType: 'join',
      time: 'Сейчас'
    },
    {
      id: '2',
      title: 'Онлайн-встреча с главой района',
      description: 'Через 2 часа',
      type: 'meeting',
      color: '#3b82f6',
      icon: Users,
      action: 'Подробнее',
      actionType: 'details',
      time: 'Через 2 часа'
    },
    {
      id: '3',
      title: 'Субботник в Центральном парке',
      description: 'Завтра, 10:00',
      type: 'event',
      color: '#8b5cf6',
      icon: Calendar,
      action: 'Участвовать',
      actionType: 'participate',
      time: 'Завтра, 10:00'
    },
    {
      id: '4',
      title: 'Начало приема заявок',
      description: '15 Авг • Программа поддержки фермеров',
      type: 'application',
      color: '#f59e0b',
      icon: AlertCircle,
      action: 'Подать заявку',
      actionType: 'apply',
      time: '15 Авг'
    }
  ];

  const mockOnlineFriends = [
    { id: '1', name: 'Maria Popova', avatar: '👩‍💼' },
    { id: '2', name: 'Dmitry Orlov', avatar: '👨‍💻' },
    { id: '3', name: 'Anna Karenina', avatar: '👩‍🎨' },
    { id: '4', name: 'Pavel Durov', avatar: '👨‍🚀' }
  ];

  const popularHashtags = [
    '#Community',
    '#Agriculture', 
    '#Notice',
    '#ZIONCITY'
  ];

  const filters = [
    { key: 'all', label: 'Все' },
    { key: 'news', label: 'Новости' },
    { key: 'events', label: 'События' }
  ];

  // Filter events based on search and filter
  const filteredEvents = mockEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || event.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const handleEventAction = (event) => {
    console.log(`Action: ${event.actionType} for event: ${event.title}`);
    // TODO: Implement actual event actions
  };

  return (
    <div className="enhanced-events-panel">
      {/* Events Header */}
      <div className="events-header">
        <h3>События</h3>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <div className="search-input-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Quick Filters */}
      <div className="quick-filters-section">
        <h4>Быстрые фильтры</h4>
        <div className="filter-buttons">
          {filters.map((filter) => (
            <button
              key={filter.key}
              className={`filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter.key)}
              style={{ 
                backgroundColor: activeFilter === filter.key ? moduleColor : undefined,
                borderColor: activeFilter === filter.key ? moduleColor : undefined,
                color: activeFilter === filter.key ? 'white' : undefined
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="events-list">
        {filteredEvents.length === 0 ? (
          <div className="empty-events">
            <Calendar size={32} color="#9ca3af" />
            <p>Нет событий</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const IconComponent = event.icon;
            return (
              <div key={event.id} className="event-card">
                <div className="event-icon" style={{ backgroundColor: event.color }}>
                  <IconComponent size={16} color="white" />
                </div>
                <div className="event-content">
                  <h5>{event.title}</h5>
                  <p>{event.description}</p>
                  {event.actionType === 'join' && (
                    <button 
                      className="event-action-btn primary"
                      style={{ backgroundColor: event.color }}
                      onClick={() => handleEventAction(event)}
                    >
                      {event.action}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Online Friends Section */}
      <div className="online-section">
        <h4>Онлайн</h4>
        <div className="online-friends">
          {mockOnlineFriends.map((friend) => (
            <div key={friend.id} className="online-friend">
              <div className="friend-avatar">
                <span>{friend.avatar}</span>
                <div className="online-indicator"></div>
              </div>
              <span className="friend-name">{friend.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Hashtags */}
      <div className="popular-section">
        <h4>Популярное</h4>
        <div className="hashtags">
          {popularHashtags.map((hashtag, index) => (
            <a 
              key={index} 
              href="#" 
              className="hashtag"
              style={{ color: moduleColor }}
            >
              {hashtag}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default EnhancedEventsPanel;