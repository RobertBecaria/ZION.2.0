/**
 * FamilyProfileWorldZone Component
 * Right sidebar widgets for Family Profile views
 */
import React from 'react';
import { Users, UserPlus, MessageCircle } from 'lucide-react';

const FamilyProfileWorldZone = ({ 
  moduleColor,
  setActiveView
}) => {
  return (
    <div className="family-profile-world-zone">
      {/* Family Profile Stats Widget */}
      <div className="widget family-stats-widget">
        <div className="widget-header">
          <Users size={16} />
          <span>Семейные профили</span>
        </div>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-number">0</span>
            <span className="stat-label">Мои семьи</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">0</span>
            <span className="stat-label">Подписчики</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">0</span>
            <span className="stat-label">Семейные посты</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">0</span>
            <span className="stat-label">Приглашения</span>
          </div>
        </div>
      </div>

      {/* Family Quick Actions Widget */}
      <div className="widget family-actions-widget">
        <div className="widget-header">
          <span>Быстрые действия</span>
        </div>
        <div className="quick-actions-list">
          <button 
            className="quick-action-btn"
            style={{ backgroundColor: moduleColor }}
            onClick={() => setActiveView('family-create')}
          >
            <UserPlus size={16} />
            <span>Создать семью</span>
          </button>
          <button
            className="quick-action-btn"
            onClick={() => {}}
          >
            <MessageCircle size={16} />
            <span>Семейный пост</span>
          </button>
        </div>
      </div>

      {/* Family Help Widget */}
      <div className="widget family-help-widget">
        <div className="widget-header">
          <span>Информация</span>
        </div>
        <div className="help-content">
          <p className="help-text">
            <strong>Семейные профили</strong> позволяют создавать отдельные страницы для каждого домохозяйства и делиться семейными новостями.
          </p>
          <p className="help-text">
            Приглашайте родственников и друзей семьи для подписки на ваши обновления.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FamilyProfileWorldZone;
