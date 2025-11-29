/**
 * MediaWorldZone Component
 * Right sidebar widgets for Media Storage views (Photos, Videos, Documents)
 */
import React from 'react';
import { 
  Image, FileText, Video, Filter, Grid, Users, Newspaper, Book,
  Building2, ShoppingCart, DollarSign, Calendar, Upload, FolderPlus, Download
} from 'lucide-react';
import { MODULES } from '../config/moduleConfig';

const MediaWorldZone = ({
  activeView,
  moduleColor,
  mediaStats = {},
  selectedModuleFilter = 'all',
  setSelectedModuleFilter
}) => {
  const getMediaIcon = () => {
    switch (activeView) {
      case 'media-photos': return <Image size={16} />;
      case 'media-documents': return <FileText size={16} />;
      case 'media-videos': return <Video size={16} />;
      default: return <Image size={16} />;
    }
  };

  const getMediaLabel = () => {
    switch (activeView) {
      case 'media-photos': return 'Фото';
      case 'media-documents': return 'Документы';
      case 'media-videos': return 'Видео';
      default: return 'Файлы';
    }
  };

  const moduleFilters = [
    { key: 'all', label: 'Все', icon: <Grid size={16} />, color: '#6B7280' },
    { key: 'family', label: 'Семья', icon: <Users size={16} />, color: '#059669' },
    { key: 'news', label: 'Новости', icon: <Newspaper size={16} />, color: '#1D4ED8' },
    { key: 'journal', label: 'Журнал', icon: <Book size={16} />, color: '#6D28D9' },
    { key: 'services', label: 'Сервисы', icon: <Grid size={16} />, color: '#B91C1C' },
    { key: 'organizations', label: 'Организации', icon: <Building2 size={16} />, color: '#C2410C' },
    { key: 'marketplace', label: 'Маркетплейс', icon: <ShoppingCart size={16} />, color: '#BE185D' },
    { key: 'finance', label: 'Финансы', icon: <DollarSign size={16} />, color: '#A16207' },
    { key: 'events', label: 'Мероприятия', icon: <Calendar size={16} />, color: '#7E22CE' }
  ];

  return (
    <div className="media-world-zone">
      {/* Media Stats Widget */}
      <div className="widget media-stats-widget">
        <div className="widget-header">
          <div className="media-icon" style={{ color: moduleColor }}>
            {getMediaIcon()}
          </div>
          <span>Статистика медиа</span>
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-number">{mediaStats.all || 0}</span>
            <span className="stat-label">{getMediaLabel()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {selectedModuleFilter === 'all' 
                ? Object.keys(mediaStats).filter(key => key !== 'all' && mediaStats[key] > 0).length
                : mediaStats[selectedModuleFilter] || 0
              }
            </span>
            <span className="stat-label">
              {selectedModuleFilter === 'all' ? 'Разделов с файлами' : 'Файлов в разделе'}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {Object.keys(mediaStats).filter(key => key !== 'all').length}
            </span>
            <span className="stat-label">Всего разделов</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">0</span>
            <span className="stat-label">Альбомов</span>
          </div>
        </div>
      </div>

      {/* Module Filters Widget */}
      <div className="widget module-filters-widget">
        <div className="widget-header">
          <Filter size={16} />
          <span>Разделы</span>
        </div>
        <div className="module-filter-list">
          {moduleFilters.map(filter => (
            <button 
              key={filter.key}
              className={`module-filter-item ${selectedModuleFilter === filter.key ? 'active' : ''}`}
              onClick={() => setSelectedModuleFilter(filter.key)}
            >
              <span style={{ color: filter.color }}>{filter.icon}</span>
              <div className="module-color-dot" style={{ backgroundColor: filter.color }}></div>
              <span>{filter.label}</span>
              <span className="file-count">{mediaStats[filter.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions Widget */}
      <div className="widget media-actions-widget">
        <div className="widget-header">
          <span>Быстрые действия</span>
        </div>
        <div className="quick-actions-list">
          <button className="quick-action-btn" style={{ backgroundColor: moduleColor }}>
            <Upload size={16} />
            <span>Загрузить файлы</span>
          </button>
          <button className="quick-action-btn">
            <FolderPlus size={16} />
            <span>Создать альбом</span>
          </button>
          <button className="quick-action-btn">
            <Download size={16} />
            <span>Скачать все</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaWorldZone;
