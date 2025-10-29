import React, { useState } from 'react';
import { Pin, AlertCircle, Info, Eye, ThumbsUp, Heart, Flame, MessageCircle, Edit3, Trash2, MoreHorizontal, Smile } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;

function WorkAnnouncementCard({ announcement, onEdit, onDelete, onPin, onReact, currentUserId, moduleColor = '#C2410C', organizationId }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const handlePinToggle = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/announcements/${announcement.id}/pin`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_pinned: !announcement.is_pinned })
        }
      );

      if (response.ok) {
        onPin(announcement.id, !announcement.is_pinned);
      }
    } catch (error) {
      console.error('Error pinning announcement:', error);
    }
    setShowMenu(false);
  };

  const handleReact = async (reactionType) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/announcements/${announcement.id}/react`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reaction_type: reactionType })
        }
      );

      if (response.ok) {
        const data = await response.json();
        onReact(announcement.id, reactionType, data.data.reactions);
      }
    } catch (error) {
      console.error('Error reacting to announcement:', error);
    }
    setShowReactions(false);
  };

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

  const priorityConfig = getPriorityConfig(announcement.priority);
  const PriorityIcon = priorityConfig.icon;

  const reactions = [
    { type: 'thumbsup', icon: ThumbsUp, label: 'Нравится' },
    { type: 'heart', icon: Heart, label: 'Любовь' },
    { type: 'smile', icon: Smile, label: 'Улыбка' },
    { type: 'fire', icon: Flame, label: 'Огонь' }
  ];

  const totalReactions = Object.values(announcement.reactions || {}).reduce((sum, count) => sum + count, 0);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="announcement-card" style={{ borderLeft: `4px solid ${priorityConfig.color}` }}>
      {/* Pinned Badge */}
      {announcement.is_pinned && (
        <div className="pinned-banner" style={{ background: priorityConfig.bg }}>
          <Pin size={14} style={{ color: priorityConfig.color }} />
          <span style={{ color: priorityConfig.color }}>Закрепленное объявление</span>
        </div>
      )}

      {/* Header */}
      <div className="card-header">
        <div className="header-left">
          {announcement.author_avatar ? (
            <img src={announcement.author_avatar} alt={announcement.author_name} className="author-avatar" />
          ) : (
            <div className="author-avatar-placeholder" style={{ background: moduleColor }}>
              {announcement.author_name?.[0]}
            </div>
          )}
          <div className="author-info">
            <div className="author-name">{announcement.author_name}</div>
            <div className="announcement-meta">
              <span className="meta-date">{formatDate(announcement.created_at)}</span>
              {announcement.department_name && (
                <>
                  <span className="meta-separator">•</span>
                  <div className="meta-department">
                    <div className="dept-color-dot" style={{ background: announcement.department_color }} />
                    <span>{announcement.department_name}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="header-right">
          <div
            className="priority-badge"
            style={{ background: priorityConfig.bg, color: priorityConfig.color }}
          >
            <PriorityIcon size={14} />
            <span>{priorityConfig.label}</span>
          </div>

          {/* Menu Button */}
          <div className="menu-container">
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>
              <MoreHorizontal size={20} />
            </button>
            {showMenu && (
              <div className="menu-dropdown">
                <button className="menu-item" onClick={() => { onEdit(announcement); setShowMenu(false); }}>
                  <Edit3 size={16} />
                  <span>Редактировать</span>
                </button>
                <button className="menu-item" onClick={handlePinToggle}>
                  <Pin size={16} />
                  <span>{announcement.is_pinned ? 'Открепить' : 'Закрепить'}</span>
                </button>
                <button className="menu-item delete" onClick={() => { onDelete(announcement.id); setShowMenu(false); }}>
                  <Trash2 size={16} />
                  <span>Удалить</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="card-content">
        <h3 className="announcement-title">{announcement.title}</h3>
        <p className="announcement-content">{announcement.content}</p>

        {/* Target Audience */}
        {announcement.target_type === 'DEPARTMENTS' && announcement.target_departments && announcement.target_departments.length > 0 && (
          <div className="target-audience">
            <span className="target-label">Для отделов:</span>
            {/* Display department names if available, otherwise show IDs */}
            <span className="target-dept">Отделы: {announcement.target_departments.length}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="card-footer">
        <div className="footer-stats">
          <div className="stat-item">
            <Eye size={16} />
            <span>{announcement.views} просмотров</span>
          </div>
          {totalReactions > 0 && (
            <div className="stat-item reactions-stat">
              {Object.entries(announcement.reactions || {}).map(([type, count]) => {
                const reaction = reactions.find(r => r.type === type);
                const ReactionIcon = reaction?.icon;
                return count > 0 && ReactionIcon ? (
                  <span key={type} className="reaction-count">
                    <ReactionIcon size={14} style={{ color: moduleColor }} />
                    {count}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        <div className="footer-actions">
          {/* Reactions Button */}
          <div className="reaction-container">
            <button
              className="action-btn"
              onClick={() => setShowReactions(!showReactions)}
              onMouseEnter={() => setShowReactions(true)}
              onMouseLeave={() => setTimeout(() => setShowReactions(false), 1000)}
            >
              <ThumbsUp size={18} />
              <span>Реакция</span>
            </button>
            {showReactions && (
              <div className="reactions-popup">
                {reactions.map((reaction) => {
                  const ReactionIcon = reaction.icon;
                  return (
                    <button
                      key={reaction.type}
                      className="reaction-btn"
                      onClick={() => handleReact(reaction.type)}
                      title={reaction.label}
                    >
                      <ReactionIcon size={24} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button className="action-btn">
            <MessageCircle size={18} />
            <span>Комментарий</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .announcement-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #E4E6EB;
          overflow: hidden;
          margin-bottom: 1rem;
          transition: box-shadow 0.2s;
        }

        .announcement-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .pinned-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          font-size: 0.8125rem;
          font-weight: 600;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1rem 1rem 0.75rem;
        }

        .header-left {
          display: flex;
          gap: 0.75rem;
          flex: 1;
        }

        .author-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
        }

        .author-avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 1rem;
        }

        .author-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .author-name {
          font-weight: 600;
          color: #050505;
          font-size: 0.9375rem;
        }

        .announcement-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          color: #65676B;
        }

        .meta-separator {
          color: #BCC0C4;
        }

        .meta-department {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .dept-color-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .header-right {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .priority-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 600;
        }

        .menu-container {
          position: relative;
        }

        .menu-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.375rem;
          color: #65676B;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .menu-btn:hover {
          background: #F0F2F5;
        }

        .menu-dropdown {
          position: absolute;
          right: 0;
          top: 100%;
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 200px;
          z-index: 10;
          overflow: hidden;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.2s;
          color: #050505;
          font-size: 0.9375rem;
        }

        .menu-item:hover {
          background: #F0F2F5;
        }

        .menu-item.delete {
          color: #DC2626;
        }

        .menu-item.delete:hover {
          background: #FEE2E2;
        }

        .card-content {
          padding: 0 1rem 1rem;
        }

        .announcement-title {
          margin: 0 0 0.75rem;
          font-size: 1.25rem;
          font-weight: 700;
          color: #050505;
          line-height: 1.4;
        }

        .announcement-content {
          margin: 0 0 1rem;
          font-size: 0.9375rem;
          color: #050505;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .target-audience {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          padding: 0.75rem;
          background: #F8F9FA;
          border-radius: 8px;
        }

        .target-label {
          font-size: 0.8125rem;
          color: #65676B;
          font-weight: 600;
        }

        .target-dept {
          display: inline-block;
          padding: 0.25rem 0.625rem;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 600;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-top: 1px solid #E4E6EB;
        }

        .footer-stats {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.8125rem;
          color: #65676B;
        }

        .reactions-stat {
          display: flex;
          gap: 0.5rem;
        }

        .reaction-count {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .footer-actions {
          display: flex;
          gap: 0.5rem;
        }

        .reaction-container {
          position: relative;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
          color: #65676B;
          font-weight: 500;
          font-size: 0.9375rem;
        }

        .action-btn:hover {
          background: #F0F2F5;
        }

        .reactions-popup {
          position: absolute;
          bottom: 100%;
          left: 0;
          display: flex;
          gap: 0.25rem;
          padding: 0.5rem;
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          margin-bottom: 0.5rem;
        }

        .reaction-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          color: #65676B;
        }

        .reaction-btn:hover {
          background: #F0F2F5;
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
}

export default WorkAnnouncementCard;