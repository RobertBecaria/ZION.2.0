import React, { useState, useEffect } from 'react';
import { 
  Users, ArrowLeft, BookOpen, Calendar, Clock,
  ChevronRight, GraduationCap, User
} from 'lucide-react';


import { BACKEND_URL } from '../config/api';
const MyClassesList = ({ selectedSchool, role, onBack, onSelectClass, moduleColor = '#6D28D9' }) => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchClasses();
  }, [selectedSchool]);


  const fetchClasses = async () => {
    if (!selectedSchool?.organization_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${selectedSchool.organization_id}/classes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      } else if (response.status === 404) {
        // API endpoint may not exist yet - use sample data
        setClasses(getSampleClasses());
      } else {
        setError('Не удалось загрузить классы');
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      // Use sample data as fallback
      setClasses(getSampleClasses());
    } finally {
      setLoading(false);
    }
  };

  const getSampleClasses = () => {
    return [
      {
        id: '1',
        name: '5-А',
        grade: 5,
        students_count: 28,
        class_teacher: 'Иванова А.П.',
        subjects: ['Математика', 'Алгебра'],
        schedule_count: 5
      },
      {
        id: '2',
        name: '6-Б',
        grade: 6,
        students_count: 25,
        class_teacher: 'Петрова Е.В.',
        subjects: ['Математика'],
        schedule_count: 4
      },
      {
        id: '3',
        name: '7-В',
        grade: 7,
        students_count: 30,
        class_teacher: 'Сидорова М.И.',
        subjects: ['Математика', 'Геометрия'],
        schedule_count: 6
      },
      {
        id: '4',
        name: '8-А',
        grade: 8,
        students_count: 27,
        class_teacher: 'Козлова Н.С.',
        subjects: ['Алгебра', 'Геометрия'],
        schedule_count: 5
      }
    ];
  };

  const getGradeColor = (grade) => {
    const colors = {
      1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#eab308',
      5: '#84cc16', 6: '#22c55e', 7: '#10b981', 8: '#14b8a6',
      9: '#06b6d4', 10: '#0ea5e9', 11: '#3b82f6'
    };
    return colors[grade] || moduleColor;
  };

  if (loading) {
    return (
      <div className="my-classes-list">
        <div className="classes-header">
          <button className="back-button" onClick={onBack}>
            <ArrowLeft size={20} />
            <span>Назад</span>
          </button>
          <h2>Мои Классы</h2>
        </div>
        <div className="loading-state">
          <div className="loading-spinner" style={{ borderTopColor: moduleColor }}></div>
          <p>Загрузка классов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-classes-list">
        <div className="classes-header">
          <button className="back-button" onClick={onBack}>
            <ArrowLeft size={20} />
            <span>Назад</span>
          </button>
          <h2>Мои Классы</h2>
        </div>
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchClasses} style={{ color: moduleColor }}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-classes-list">
      <div className="classes-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={20} />
          <span>Назад</span>
        </button>
        <div className="header-content">
          <h2>
            <GraduationCap size={24} style={{ color: moduleColor }} />
            Мои Классы
          </h2>
          <span className="classes-count" style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}>
            {classes.length} {classes.length === 1 ? 'класс' : classes.length < 5 ? 'класса' : 'классов'}
          </span>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="empty-state">
          <Users size={48} style={{ color: '#9CA3AF' }} />
          <h3>Нет назначенных классов</h3>
          <p>У вас пока нет классов в этой школе</p>
        </div>
      ) : (
        <div className="classes-grid">
          {classes.map((classItem) => (
            <div 
              key={classItem.id} 
              className="class-card"
              onClick={() => onSelectClass && onSelectClass(classItem)}
              style={{ cursor: onSelectClass ? 'pointer' : 'default' }}
            >
              <div className="class-card-header">
                <div 
                  className="class-badge"
                  style={{ backgroundColor: getGradeColor(classItem.grade) }}
                >
                  {classItem.name}
                </div>
                {classItem.is_class_teacher && (
                  <span className="class-teacher-badge" style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}>
                    Классный руководитель
                  </span>
                )}
              </div>

              <div className="class-card-content">
                <div className="class-info-row">
                  <Users size={16} />
                  <span>{classItem.students_count} учеников</span>
                </div>

                {classItem.subjects && classItem.subjects.length > 0 && (
                  <div className="class-info-row">
                    <BookOpen size={16} />
                    <span>{classItem.subjects.join(', ')}</span>
                  </div>
                )}

                {classItem.schedule_count > 0 && (
                  <div className="class-info-row">
                    <Calendar size={16} />
                    <span>{classItem.schedule_count} уроков в неделю</span>
                  </div>
                )}

                {classItem.class_teacher && !classItem.is_class_teacher && (
                  <div className="class-info-row">
                    <User size={16} />
                    <span>Кл. рук.: {classItem.class_teacher}</span>
                  </div>
                )}
              </div>

              {onSelectClass && (
                <div className="class-card-footer">
                  <span>Подробнее</span>
                  <ChevronRight size={18} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .my-classes-list {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .classes-header {
          margin-bottom: 24px;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          color: #6B7280;
          font-size: 14px;
          cursor: pointer;
          padding: 8px 0;
          margin-bottom: 16px;
          transition: color 0.2s;
        }

        .back-button:hover {
          color: ${moduleColor};
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-content h2 {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 24px;
          font-weight: 600;
          color: #1F2937;
          margin: 0;
        }

        .classes-count {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .loading-state, .error-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #E5E7EB;
          border-top-width: 3px;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state h3 {
          margin: 16px 0 8px;
          font-size: 18px;
          color: #374151;
        }

        .empty-state p {
          color: #6B7280;
          margin: 0;
        }

        .classes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .class-card {
          background: white;
          border-radius: 12px;
          border: 1px solid #E5E7EB;
          overflow: hidden;
          transition: all 0.2s;
        }

        .class-card:hover {
          border-color: ${moduleColor}40;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .class-card-header {
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid #F3F4F6;
        }

        .class-badge {
          padding: 8px 16px;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          font-size: 18px;
        }

        .class-teacher-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .class-card-content {
          padding: 16px;
        }

        .class-info-row {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #6B7280;
          font-size: 14px;
          margin-bottom: 10px;
        }

        .class-info-row:last-child {
          margin-bottom: 0;
        }

        .class-info-row svg {
          color: #9CA3AF;
          flex-shrink: 0;
        }

        .class-card-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          padding: 12px 16px;
          background: #F9FAFB;
          color: ${moduleColor};
          font-size: 14px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

export default MyClassesList;
