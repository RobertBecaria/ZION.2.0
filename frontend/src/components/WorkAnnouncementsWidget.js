import React, { useState } from 'react';
import { Megaphone, Pin, AlertCircle, Info, ChevronRight, Eye } from 'lucide-react';
import { getAnnouncementsByOrg } from '../mock-work';

function WorkAnnouncementsWidget({ organizationId, departmentId = null, onViewAll, moduleColor = '#C2410C' }) {
  const [expanded, setExpanded] = useState(true);
  const announcements = getAnnouncementsByOrg(organizationId, departmentId).slice(0, 5);
  const urgentCount = announcements.filter(a => a.priority === 'URGENT').length;

  const getPriorityConfig = (priority) => {
    switch (priority) {
      case 'URGENT':
        return { color: '#DC2626', bg: '#FEE2E2', icon: AlertCircle, label: 'Срочно' };
      case 'IMPORTANT':
        return { color: '#F59E0B', bg: '#FEF3C7', icon: AlertCircle, label: 'Важно' };
      default:
        return { color: '#059669', bg: '#D1FAE5', icon: Info, label: 'Обычно' };
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="widget announcements-widget">
      <div className="widget-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <Megaphone size={16} style={{ color: moduleColor }} />
        <span>Объявления</span>
        <div className="widget-actions">
          {urgentCount > 0 && (
            <span className="badge urgent" style={{ background: '#DC2626', color: 'white' }}>
              {urgentCount}
            </span>
          )}
          <span className="badge" style={{ background: `${moduleColor}20`, color: moduleColor }}>
            {announcements.length}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="announcements-content">
          {announcements.length === 0 ? (
            <div className="empty-state">
              <Megaphone size={32} style={{ color: '#BCC0C4' }} />
              <p>Нет объявлений</p>
            </div>
          ) : (
            <>
              {announcements.map((announcement) => {
                const priorityConfig = getPriorityConfig(announcement.priority);
                const PriorityIcon = priorityConfig.icon;
                const totalReactions = Object.values(announcement.reactions || {}).reduce((sum, count) => sum + count, 0);

                return (
                  <div key={announcement.id} className="announcement-item">
                    {announcement.is_pinned && (
                      <div className="pinned-badge">
                        <Pin size={12} />
                        <span>Закреплено</span>
                      </div>
                    )}

                    <div className="announcement-header">
                      <div
                        className="priority-badge"
                        style={{
                          background: priorityConfig.bg,
                          color: priorityConfig.color
                        }}
                      >
                        <PriorityIcon size={12} />
                        <span>{priorityConfig.label}</span>
                      </div>
                      <span className="announcement-time">{formatDate(announcement.created_at)}</span>
                    </div>

                    <h4 className="announcement-title">{announcement.title}</h4>
                    <p className="announcement-preview">
                      {announcement.content.length > 80
                        ? announcement.content.substring(0, 80) + '...'
                        : announcement.content}
                    </p>

                    <div className="announcement-footer">
                      <div className="announcement-author">
                        <span>от {announcement.author_name}</span>
                        {announcement.department_id && (
                          <span className="dept-tag">• Отдел</span>
                        )}
                      </div>
                      <div className="announcement-stats">
                        <span title="Просмотры">
                          <Eye size={12} /> {announcement.views}
                        </span>
                        {totalReactions > 0 && (
                          <span title="Реакции">❤️ {totalReactions}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                className="view-all-btn"
                onClick={onViewAll}
                style={{ color: moduleColor, borderColor: `${moduleColor}40` }}
              >
                <span>Посмотреть все объявления</span>
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .announcements-widget {
          margin-bottom: 1rem;
        }

        .announcements-content {
          padding: 0.5rem 0;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1rem;
          color: #65676B;
          text-align: center;
        }

        .empty-state p {
          margin-top: 0.5rem;
          font-size: 0.875rem;
        }

        .announcement-item {
          padding: 0.75rem;
          margin: 0 0.5rem 0.5rem;
          background: #F8F9FA;
          border-radius: 8px;
          border-left: 3px solid #E4E6EB;
          transition: all 0.2s ease;
        }

        .announcement-item:hover {
          background: #F0F2F5;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .pinned-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: #FEF3C7;
          color: #F59E0B;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .announcement-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .priority-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .announcement-time {
          font-size: 0.7rem;
          color: #65676B;
        }

        .announcement-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #050505;
          margin-bottom: 0.375rem;
          line-height: 1.3;
        }

        .announcement-preview {
          font-size: 0.8rem;
          color: #65676B;
          line-height: 1.4;
          margin-bottom: 0.5rem;
        }

        .announcement-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: #65676B;
        }

        .announcement-author {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .dept-tag {
          color: #1D4ED8;
          font-weight: 500;
        }

        .announcement-stats {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .announcement-stats span {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .view-all-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: calc(100% - 1rem);
          margin: 0.5rem 0.5rem 0;
          padding: 0.625rem;
          background: transparent;
          border: 1px solid;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .view-all-btn:hover {
          opacity: 0.8;
          transform: translateY(-1px);
        }

        .badge.urgent {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

export default WorkAnnouncementsWidget;