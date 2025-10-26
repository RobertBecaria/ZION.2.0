import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Filter, AlertCircle, Info, ArrowLeft, X } from 'lucide-react';
import WorkAnnouncementCard from './WorkAnnouncementCard';
import WorkAnnouncementComposer from './WorkAnnouncementComposer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;

function WorkAnnouncementsList({ organizationId, onBack, currentUserId, moduleColor = '#C2410C' }) {
  const [announcements, setAnnouncements] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [filters, setFilters] = useState({
    priority: 'all',
    department: 'all',
    pinned: 'all'
  });

  useEffect(() => {
    fetchDepartments();
    fetchAnnouncements();
  }, [organizationId]);

  useEffect(() => {
    fetchAnnouncements();
  }, [filters]);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      let url = `${BACKEND_URL}/api/organizations/${organizationId}/announcements?`;
      
      if (filters.priority !== 'all') {
        url += `priority=${filters.priority}&`;
      }
      if (filters.department !== 'all') {
        url += `department_id=${filters.department}&`;
      }
      if (filters.pinned !== 'all') {
        url += `pinned=${filters.pinned === 'pinned'}&`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (announcementData) => {
    try {
      const token = localStorage.getItem('zion_token');
      
      if (editingAnnouncement) {
        // Update existing
        const response = await fetch(
          `${BACKEND_URL}/api/organizations/${organizationId}/announcements/${editingAnnouncement.id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(announcementData)
          }
        );

        if (response.ok) {
          alert('Объявление обновлено!');
          await fetchAnnouncements();
        } else {
          const error = await response.json();
          alert(error.detail || 'Ошибка при обновлении');
        }
      } else {
        // Create new
        const response = await fetch(
          `${BACKEND_URL}/api/organizations/${organizationId}/announcements`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(announcementData)
          }
        );

        if (response.ok) {
          alert('Объявление опубликовано!');
          await fetchAnnouncements();
        } else {
          const error = await response.json();
          alert(error.detail || 'Ошибка при создании');
        }
      }

      setShowComposer(false);
      setEditingAnnouncement(null);
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert('Произошла ошибка');
    }
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setShowComposer(true);
  };

  const handleDelete = async (announcementId) => {
    if (window.confirm('Удалить это объявление?')) {
      try {
        const token = localStorage.getItem('zion_token');
        const response = await fetch(
          `${BACKEND_URL}/api/organizations/${organizationId}/announcements/${announcementId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          alert('Объявление удалено');
          await fetchAnnouncements();
        } else {
          const error = await response.json();
          alert(error.detail || 'Ошибка при удалении');
        }
      } catch (error) {
        console.error('Error deleting announcement:', error);
        alert('Произошла ошибка');
      }
    }
  };

  const handlePin = async (announcementId, isPinned) => {
    // Just refresh - the card handles the actual API call
    await fetchAnnouncements();
  };

  const handleReact = async (announcementId, reactionType, newReactions) => {
    // Update local state with new reactions
    setAnnouncements(announcements.map(a => 
      a.id === announcementId 
        ? { ...a, reactions: newReactions }
        : a
    ));
  };

  const stats = {
    total: announcements.length,
    urgent: announcements.filter(a => a.priority === 'URGENT').length,
    important: announcements.filter(a => a.priority === 'IMPORTANT').length,
    pinned: announcements.filter(a => a.is_pinned).length
  };

  return (
    <div className="announcements-list-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <div className="header-content">
          <div className="header-left">
            <div className="icon-badge" style={{ background: `${moduleColor}15`, color: moduleColor }}>
              <Megaphone size={28} />
            </div>
            <div>
              <h1>Объявления организации</h1>
              <p>{loading ? 'Загрузка...' : `${announcements.length} объявлений`}</p>
            </div>
          </div>
          <button
            className="create-btn"
            onClick={() => {
              setEditingAnnouncement(null);
              setShowComposer(true);
            }}
            style={{ background: moduleColor }}
          >
            <Plus size={20} />
            Создать объявление
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Всего</span>
        </div>
        <div className="stat-item urgent">
          <span className="stat-number">{stats.urgent}</span>
          <span className="stat-label">Срочных</span>
        </div>
        <div className="stat-item important">
          <span className="stat-number">{stats.important}</span>
          <span className="stat-label">Важных</span>
        </div>
        <div className="stat-item pinned">
          <span className="stat-number">{stats.pinned}</span>
          <span className="stat-label">Закрепленных</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-header">
          <div className="filters-title">
            <Filter size={18} />
            <span>Фильтры</span>
          </div>
          {(filters.priority !== 'all' || filters.department !== 'all' || filters.pinned !== 'all') && (
            <button
              className="clear-filters-btn"
              onClick={() => setFilters({ priority: 'all', department: 'all', pinned: 'all' })}
            >
              <X size={16} />
              Очистить
            </button>
          )}
        </div>

        <div className="filters-row">
          {/* Priority Filter */}
          <select
            className="filter-select"
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="all">Все приоритеты</option>
            <option value="URGENT">🔴 Срочно</option>
            <option value="IMPORTANT">🟡 Важно</option>
            <option value="NORMAL">🟢 Обычно</option>
          </select>

          {/* Department Filter */}
          <select
            className="filter-select"
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          >
            <option value="all">Все отделы</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          {/* Pinned Filter */}
          <select
            className="filter-select"
            value={filters.pinned}
            onChange={(e) => setFilters({ ...filters, pinned: e.target.value })}
          >
            <option value="all">Все объявления</option>
            <option value="pinned">📌 Закрепленные</option>
            <option value="unpinned">Не закрепленные</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      <div className="announcements-container">
        {loading ? (
          <div className="loading-state">
            <Megaphone size={48} style={{ color: '#BCC0C4' }} />
            <p>Загрузка объявлений...</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={64} style={{ color: '#BCC0C4' }} />
            <h3>Нет объявлений</h3>
            <p>Создайте первое объявление для вашей организации</p>
            <button
              className="empty-state-btn"
              onClick={() => setShowComposer(true)}
              style={{ background: moduleColor }}
            >
              <Plus size={18} />
              Создать объявление
            </button>
          </div>
        ) : (
          announcements.map(announcement => (
            <WorkAnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPin={handlePin}
              onReact={handleReact}
              currentUserId={currentUserId}
              organizationId={organizationId}
              moduleColor={moduleColor}
            />
          ))
        )}
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <WorkAnnouncementComposer
          organizationId={organizationId}
          onClose={() => {
            setShowComposer(false);
            setEditingAnnouncement(null);
          }}
          onSave={handleSave}
          editingAnnouncement={editingAnnouncement}
          moduleColor={moduleColor}
        />
      )}

      <style jsx>{`
        .announcements-list-page {
          padding: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .back-btn {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: #F0F2F5;
        }

        .header-content {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .icon-badge {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-left h1 {
          margin: 0;
          font-size: 1.75rem;
          color: #050505;
        }

        .header-left p {
          margin: 0.25rem 0 0;
          font-size: 0.9375rem;
          color: #65676B;
        }

        .create-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .create-btn:hover {
          opacity: 0.9;
        }

        .stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stat-item {
          background: white;
          padding: 1.25rem;
          border-radius: 12px;
          border: 1px solid #E4E6EB;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .stat-number {
          font-size: 2rem;
          font-weight: 700;
          color: #050505;
        }

        .stat-label {
          font-size: 0.8125rem;
          color: #65676B;
          font-weight: 500;
        }

        .stat-item.urgent .stat-number {
          color: #DC2626;
        }

        .stat-item.important .stat-number {
          color: #F59E0B;
        }

        .stat-item.pinned .stat-number {
          color: #7E22CE;
        }

        .filters-section {
          background: white;
          padding: 1.25rem;
          border-radius: 12px;
          border: 1px solid #E4E6EB;
          margin-bottom: 1.5rem;
        }

        .filters-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .filters-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: #050505;
        }

        .clear-filters-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          background: #F0F2F5;
          border: none;
          border-radius: 6px;
          color: #65676B;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .clear-filters-btn:hover {
          background: #E4E6EB;
        }

        .filters-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        .filter-select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .filter-select:focus {
          outline: none;
          border-color: #1D4ED8;
        }

        .announcements-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4rem 2rem;
          text-align: center;
          background: white;
          border-radius: 12px;
          border: 1px dashed #E4E6EB;
        }

        .empty-state h3 {
          margin: 1rem 0 0.5rem;
          font-size: 1.25rem;
          color: #050505;
        }

        .empty-state p {
          margin: 0 0 1.5rem;
          color: #65676B;
        }

        .empty-state-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .empty-state-btn:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}

export default WorkAnnouncementsList;