import React, { useState } from 'react';
import './App.css';
import { Clock, User, MessageCircle, Video, FileText, Settings, Search, Filter, Users } from 'lucide-react';

function App() {
  const [activeModule, setActiveModule] = useState('family');

  const modules = [
    { key: 'family', name: 'Семья', color: '#059669' },
    { key: 'news', name: 'Новости', color: '#1D4ED8' },
    { key: 'journal', name: 'Журнал', color: '#6D28D9' },
    { key: 'services', name: 'Сервисы', color: '#B91C1C' },
    { key: 'organizations', name: 'Организации', color: '#C2410C' },
    { key: 'marketplace', name: 'Маркетплейс', color: '#BE185D' },
    { key: 'finance', name: 'Финансы', color: '#A16207' },
    { key: 'events', name: 'Мероприятия', color: '#7E22CE' }
  ];

  const currentModule = modules.find(m => m.key === activeModule);
  const currentTime = new Date().toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  });

  const sidebarTintStyle = {
    backgroundColor: `${currentModule.color}08`
  };

  return (
    <div className="app">
      {/* Top Navigation Bar */}
      <nav className="top-nav" style={{ backgroundColor: currentModule.color }}>
        <div className="nav-content">
          <div className="logo-section">
            <h1 className="platform-logo">ZION.CITY</h1>
          </div>
          
          <div className="module-navigation">
            {modules.map((module) => (
              <button
                key={module.key}
                className={`nav-module ${activeModule === module.key ? 'active' : ''}`}
                onClick={() => setActiveModule(module.key)}
              >
                {module.name}
              </button>
            ))}
          </div>

          <div className="clock-widget">
            <div className="time">{currentTime}</div>
            <div className="date">{currentDate}</div>
          </div>
        </div>
      </nav>

      <div className="main-container">
        {/* Left Sidebar - "Me" Zone */}
        <aside className="left-sidebar" style={sidebarTintStyle}>
          <div className="sidebar-header">
            <h3>Личная Зона</h3>
          </div>
          <nav className="sidebar-nav">
            <a href="#profile" className="nav-item">
              <User size={20} />
              <span>Профиль</span>
            </a>
            <a href="#friends" className="nav-item">
              <Users size={20} />
              <span>Друзья</span>
            </a>
            <a href="#messages" className="nav-item">
              <MessageCircle size={20} />
              <span>Сообщения</span>
            </a>
            <a href="#videos" className="nav-item">
              <Video size={20} />
              <span>Видео</span>
            </a>
            <a href="#documents" className="nav-item">
              <FileText size={20} />
              <span>Документы</span>
            </a>
            <a href="#settings" className="nav-item">
              <Settings size={20} />
              <span>Настройки</span>
            </a>
          </nav>
        </aside>

        {/* Central Content Area */}
        <main className="content-area">
          <div className="content-header">
            <h2 className="module-title" style={{ color: currentModule.color }}>
              {currentModule.name}
            </h2>
            <div className="breadcrumb">
              <span>Главная</span> / <span>{currentModule.name}</span>
            </div>
          </div>
          
          <div className="content-body">
            {activeModule === 'family' && (
              <div className="family-dashboard">
                <div className="welcome-section">
                  <h3>Добро пожаловать в семейную зону</h3>
                  <p>Управляйте расписанием семьи, отслеживайте здоровье и оставайтесь на связи</p>
                </div>
                
                <div className="dashboard-grid">
                  <div className="dashboard-card">
                    <h4>Семейный календарь</h4>
                    <p>Сегодня: 3 события</p>
                    <div className="card-preview">
                      <div className="event-item">
                        <span className="event-time">14:00</span>
                        <span className="event-title">Прием у врача - Анна</span>
                      </div>
                      <div className="event-item">
                        <span className="event-time">16:30</span>
                        <span className="event-title">Тренировка - Максим</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="dashboard-card">
                    <h4>Состояние семьи</h4>
                    <p>Последние отметки</p>
                    <div className="health-indicators">
                      <div className="health-item">
                        <span className="member-name">Анна</span>
                        <span className="health-status good">😊 Отлично</span>
                      </div>
                      <div className="health-item">
                        <span className="member-name">Максим</span>
                        <span className="health-status good">😊 Хорошо</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="dashboard-card">
                    <h4>Сообщения семьи</h4>
                    <p>3 новых сообщения</p>
                    <div className="message-preview">
                      <div className="message-item">
                        <strong>Мама:</strong> Не забудьте про ужин в 19:00
                      </div>
                    </div>
                  </div>
                  
                  <div className="dashboard-card">
                    <h4>Геолокация</h4>
                    <p>Местоположение семьи</p>
                    <div className="location-status">
                      <div className="location-item">
                        <span className="member-name">Анна</span>
                        <span className="location">Дома</span>
                      </div>
                      <div className="location-item">
                        <span className="member-name">Максим</span>
                        <span className="location">Школа</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeModule !== 'family' && (
              <div className="module-placeholder">
                <h3>Модуль "{currentModule.name}"</h3>
                <p>Контент модуля будет размещен здесь</p>
                <div className="placeholder-content">
                  <div className="placeholder-block"></div>
                  <div className="placeholder-block"></div>
                  <div className="placeholder-block"></div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - "World" Zone */}
        <aside className="right-sidebar" style={sidebarTintStyle}>
          <div className="sidebar-header">
            <h3>Мировая Зона</h3>
          </div>
          
          {/* Horizontal Filter Row */}
          <div className="filter-section">
            <div className="filter-header">
              <Filter size={16} />
              <span>Фильтры</span>
            </div>
            <div className="filter-row">
              <button className="filter-btn active">Все</button>
              <button className="filter-btn">Семья</button>
              <button className="filter-btn">Друзья</button>
              <button className="filter-btn">Работа</button>
            </div>
          </div>

          {/* Search Widget */}
          <div className="widget search-widget">
            <div className="widget-header">
              <Search size={16} />
              <span>Поиск</span>
            </div>
            <input type="text" placeholder="Поиск по платформе..." className="search-input" />
          </div>

          {/* Friends List Widget */}
          <div className="widget friends-widget">
            <div className="widget-header">
              <Users size={16} />
              <span>Друзья онлайн</span>
            </div>
            <div className="friends-list">
              <div className="friend-item">
                <div className="friend-avatar"></div>
                <div className="friend-info">
                  <span className="friend-name">Анна Петрова</span>
                  <span className="friend-status">В сети</span>
                </div>
                <div className="status-indicator online"></div>
              </div>
              <div className="friend-item">
                <div className="friend-avatar"></div>
                <div className="friend-info">
                  <span className="friend-name">Максим Иванов</span>
                  <span className="friend-status">В сети</span>
                </div>
                <div className="status-indicator online"></div>
              </div>
              <div className="friend-item">
                <div className="friend-avatar"></div>
                <div className="friend-info">
                  <span className="friend-name">Елена Сидорова</span>
                  <span className="friend-status">Не в сети</span>
                </div>
                <div className="status-indicator offline"></div>
              </div>
            </div>
          </div>

          {/* Quick Stats Widget */}
          <div className="widget stats-widget">
            <div className="widget-header">
              <span>Быстрая статистика</span>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">12</span>
                <span className="stat-label">Сообщения</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">3</span>
                <span className="stat-label">События</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">7</span>
                <span className="stat-label">Друзья</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">24</span>
                <span className="stat-label">Уведомления</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;