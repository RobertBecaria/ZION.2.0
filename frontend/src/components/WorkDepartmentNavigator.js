import React, { useState, useEffect } from 'react';
import { Building2, Users, ChevronRight, Plus, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;

function WorkDepartmentNavigator({ organizationId, activeDepartmentId, onDepartmentSelect, onCreateDepartment, moduleColor = '#C2410C' }) {
  const [expanded, setExpanded] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchDepartments();
    }
  }, [organizationId]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
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
      } else {
        console.error('Failed to fetch departments');
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentStats = (deptId) => {
    // Mock stats for now - can be enhanced with real analytics later
    return {
      posts: Math.floor(Math.random() * 50) + 5,
      announcements: Math.floor(Math.random() * 10),
      activity: Math.floor(Math.random() * 100)
    };
  };

  if (loading) {
    return (
      <div className="widget department-navigator-widget">
        <div className="widget-header">
          <Building2 size={16} style={{ color: moduleColor }} />
          <span>Отделы</span>
        </div>
        <div className="loading-state">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="widget department-navigator-widget">
      <div className="widget-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <Building2 size={16} style={{ color: moduleColor }} />
        <span>Отделы</span>
        <div className="widget-actions">
          <span className="badge" style={{ background: `${moduleColor}20`, color: moduleColor }}>
            {departments.length}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="department-navigator-content">
          {/* All Organization View */}
          <button
            className={`department-nav-item ${!activeDepartmentId ? 'active' : ''}`}
            onClick={() => onDepartmentSelect(null)}
            style={{
              borderLeft: !activeDepartmentId ? `3px solid ${moduleColor}` : '3px solid transparent',
              background: !activeDepartmentId ? `${moduleColor}08` : 'transparent'
            }}
          >
            <div className="dept-icon" style={{ background: `${moduleColor}15` }}>
              <Building2 size={16} style={{ color: moduleColor }} />
            </div>
            <div className="dept-info">
              <span className="dept-name">Вся организация</span>
              <span className="dept-members">Все отделы</span>
            </div>
            <ChevronRight size={14} className="dept-arrow" />
          </button>

          <div className="department-divider"></div>

          {/* Department List */}
          {departments.map((dept) => {
            const stats = getDepartmentStats(dept.id);
            const isActive = activeDepartmentId === dept.id;

            return (
              <button
                key={dept.id}
                className={`department-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onDepartmentSelect(dept.id)}
                style={{
                  borderLeft: isActive ? `3px solid ${dept.color}` : '3px solid transparent',
                  background: isActive ? `${dept.color}08` : 'transparent'
                }}
              >
                <div className="dept-icon" style={{ background: `${dept.color}15` }}>
                  <div
                    className="dept-color-indicator"
                    style={{ background: dept.color, width: 12, height: 12, borderRadius: '50%' }}
                  />
                </div>
                <div className="dept-info">
                  <span className="dept-name">{dept.name}</span>
                  <div className="dept-stats">
                    <span className="dept-members">
                      <Users size={10} /> {dept.member_count}
                    </span>
                    <span className="dept-activity" title="Активность">
                      <TrendingUp size={10} /> {stats.activity}%
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} className="dept-arrow" />
              </button>
            );
          })}

          {/* Create Department Button */}
          <button
            className="create-department-btn"
            onClick={onCreateDepartment}
            style={{
              background: `${moduleColor}10`,
              color: moduleColor,
              border: `1px dashed ${moduleColor}40`
            }}
          >
            <Plus size={16} />
            <span>Создать отдел</span>
          </button>
        </div>
      )}

      <style jsx>{`
        .department-navigator-widget {
          margin-bottom: 1rem;
        }

        .department-navigator-content {
          padding: 0.5rem 0;
        }

        .department-nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          width: 100%;
          background: transparent;
          border: none;
          border-left: 3px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .department-nav-item:hover {
          background: rgba(0, 0, 0, 0.02);
        }

        .department-nav-item.active {
          font-weight: 500;
        }

        .dept-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .dept-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          min-width: 0;
        }

        .dept-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #050505;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dept-stats {
          display: flex;
          gap: 0.75rem;
          font-size: 0.75rem;
          color: #65676B;
        }

        .dept-members,
        .dept-activity {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .dept-arrow {
          color: #BCC0C4;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .department-nav-item:hover .dept-arrow,
        .department-nav-item.active .dept-arrow {
          opacity: 1;
        }

        .department-divider {
          height: 1px;
          background: #E4E6EB;
          margin: 0.5rem 0.75rem;
        }

        .create-department-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: calc(100% - 1.5rem);
          margin: 0.5rem 0.75rem 0;
          padding: 0.625rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .create-department-btn:hover {
          opacity: 0.8;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

export default WorkDepartmentNavigator;