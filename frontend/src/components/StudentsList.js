import React, { useState, useEffect } from 'react';
import { 
  Users, ArrowLeft, Search, Filter, GraduationCap,
  User, Mail, Phone, ChevronDown, X, Star, BookOpen
} from 'lucide-react';


import { BACKEND_URL } from '../config/api';
const StudentsList = ({ selectedSchool, role, onBack, moduleColor = '#6D28D9' }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [classes, setClasses] = useState([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [selectedSchool]);

  const fetchClasses = async () => {
    if (!selectedSchool?.organization_id) return;

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
      } else {
        setClasses(getSampleClasses());
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      setClasses(getSampleClasses());
    }
  };

  const fetchStudents = async () => {
    if (!selectedSchool?.organization_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${selectedSchool.organization_id}/students`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStudents(data);
      } else if (response.status === 404) {
        setStudents(getSampleStudents());
      } else {
        setError('Не удалось загрузить список учеников');
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      setStudents(getSampleStudents());
    } finally {
      setLoading(false);
    }
  };

  const getSampleClasses = () => [
    { id: '1', name: '5-А', grade: 5 },
    { id: '2', name: '6-Б', grade: 6 },
    { id: '3', name: '7-В', grade: 7 },
    { id: '4', name: '8-А', grade: 8 }
  ];

  const getSampleStudents = () => [
    {
      id: '1',
      first_name: 'Александр',
      last_name: 'Петров',
      class_name: '5-А',
      class_id: '1',
      average_grade: 4.5,
      attendance_rate: 95,
      parent_name: 'Петрова Елена Викторовна'
    },
    {
      id: '2',
      first_name: 'Мария',
      last_name: 'Иванова',
      class_name: '5-А',
      class_id: '1',
      average_grade: 4.8,
      attendance_rate: 98,
      parent_name: 'Иванов Сергей Петрович'
    },
    {
      id: '3',
      first_name: 'Дмитрий',
      last_name: 'Сидоров',
      class_name: '6-Б',
      class_id: '2',
      average_grade: 4.2,
      attendance_rate: 92,
      parent_name: 'Сидорова Анна Михайловна'
    },
    {
      id: '4',
      first_name: 'Елена',
      last_name: 'Козлова',
      class_name: '6-Б',
      class_id: '2',
      average_grade: 4.9,
      attendance_rate: 100,
      parent_name: 'Козлов Андрей Николаевич'
    },
    {
      id: '5',
      first_name: 'Никита',
      last_name: 'Федоров',
      class_name: '7-В',
      class_id: '3',
      average_grade: 3.8,
      attendance_rate: 88,
      parent_name: 'Федорова Ольга Сергеевна'
    },
    {
      id: '6',
      first_name: 'Анна',
      last_name: 'Морозова',
      class_name: '7-В',
      class_id: '3',
      average_grade: 4.6,
      attendance_rate: 96,
      parent_name: 'Морозов Виктор Александрович'
    },
    {
      id: '7',
      first_name: 'Иван',
      last_name: 'Волков',
      class_name: '8-А',
      class_id: '4',
      average_grade: 4.3,
      attendance_rate: 94,
      parent_name: 'Волкова Татьяна Игоревна'
    },
    {
      id: '8',
      first_name: 'София',
      last_name: 'Новикова',
      class_name: '8-А',
      class_id: '4',
      average_grade: 5.0,
      attendance_rate: 100,
      parent_name: 'Новиков Павел Дмитриевич'
    }
  ];

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.parent_name && student.parent_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesClass = selectedClass === 'all' || student.class_id === selectedClass;
    
    return matchesSearch && matchesClass;
  });

  const getGradeColor = (grade) => {
    if (grade >= 4.5) return '#22c55e';
    if (grade >= 4.0) return '#84cc16';
    if (grade >= 3.5) return '#f59e0b';
    return '#ef4444';
  };

  const getAttendanceColor = (rate) => {
    if (rate >= 95) return '#22c55e';
    if (rate >= 85) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="students-list">
        <div className="students-header">
          <button className="back-button" onClick={onBack}>
            <ArrowLeft size={20} />
            <span>Назад</span>
          </button>
          <h2>Ученики</h2>
        </div>
        <div className="loading-state">
          <div className="loading-spinner" style={{ borderTopColor: moduleColor }}></div>
          <p>Загрузка списка учеников...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="students-list">
        <div className="students-header">
          <button className="back-button" onClick={onBack}>
            <ArrowLeft size={20} />
            <span>Назад</span>
          </button>
          <h2>Ученики</h2>
        </div>
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchStudents} style={{ color: moduleColor }}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="students-list">
      <div className="students-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={20} />
          <span>Назад</span>
        </button>
        <div className="header-content">
          <h2>
            <Users size={24} style={{ color: moduleColor }} />
            Ученики
          </h2>
          <span className="students-count" style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}>
            {filteredStudents.length} из {students.length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Поиск по имени или родителю..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="class-filter">
          <Filter size={18} />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{ borderColor: selectedClass !== 'all' ? moduleColor : '#E5E7EB' }}
          >
            <option value="all">Все классы</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredStudents.length === 0 ? (
        <div className="empty-state">
          <Users size={48} style={{ color: '#9CA3AF' }} />
          <h3>Ученики не найдены</h3>
          <p>{searchQuery || selectedClass !== 'all' ? 'Попробуйте изменить параметры поиска' : 'В этой школе пока нет учеников'}</p>
        </div>
      ) : (
        <div className="students-table-wrapper">
          <table className="students-table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Класс</th>
                <th>Средний балл</th>
                <th>Посещаемость</th>
                <th>Родитель</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="student-name-cell">
                      <div className="student-avatar" style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}>
                        {student.first_name[0]}{student.last_name[0]}
                      </div>
                      <div className="student-info">
                        <span className="student-name">{student.last_name} {student.first_name}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="class-badge">{student.class_name}</span>
                  </td>
                  <td>
                    <span 
                      className="grade-badge"
                      style={{ 
                        backgroundColor: `${getGradeColor(student.average_grade)}15`,
                        color: getGradeColor(student.average_grade)
                      }}
                    >
                      <Star size={14} />
                      {student.average_grade?.toFixed(1) || '-'}
                    </span>
                  </td>
                  <td>
                    <span 
                      className="attendance-badge"
                      style={{ 
                        backgroundColor: `${getAttendanceColor(student.attendance_rate)}15`,
                        color: getAttendanceColor(student.attendance_rate)
                      }}
                    >
                      {student.attendance_rate}%
                    </span>
                  </td>
                  <td>
                    <span className="parent-name">{student.parent_name || '-'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .students-list {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .students-header {
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

        .students-count {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .filters-section {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: white;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 10px 16px;
          flex: 1;
          min-width: 250px;
        }

        .search-box svg {
          color: #9CA3AF;
        }

        .search-box input {
          border: none;
          outline: none;
          flex: 1;
          font-size: 14px;
        }

        .clear-search {
          background: none;
          border: none;
          color: #9CA3AF;
          cursor: pointer;
          padding: 4px;
        }

        .class-filter {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .class-filter svg {
          color: #9CA3AF;
        }

        .class-filter select {
          padding: 10px 16px;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          min-width: 150px;
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

        .students-table-wrapper {
          background: white;
          border-radius: 12px;
          border: 1px solid #E5E7EB;
          overflow: hidden;
        }

        .students-table {
          width: 100%;
          border-collapse: collapse;
        }

        .students-table th {
          text-align: left;
          padding: 14px 16px;
          background: #F9FAFB;
          font-size: 13px;
          font-weight: 600;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #E5E7EB;
        }

        .students-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #F3F4F6;
          font-size: 14px;
        }

        .students-table tr:last-child td {
          border-bottom: none;
        }

        .students-table tr:hover {
          background: #F9FAFB;
        }

        .student-name-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .student-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
        }

        .student-name {
          font-weight: 500;
          color: #1F2937;
        }

        .class-badge {
          display: inline-block;
          padding: 4px 10px;
          background: #F3F4F6;
          border-radius: 6px;
          font-weight: 500;
          color: #374151;
        }

        .grade-badge, .attendance-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 500;
        }

        .parent-name {
          color: #6B7280;
        }

        @media (max-width: 768px) {
          .filters-section {
            flex-direction: column;
          }

          .search-box {
            min-width: 100%;
          }

          .students-table-wrapper {
            overflow-x: auto;
          }

          .students-table {
            min-width: 700px;
          }
        }
      `}</style>
    </div>
  );
};

export default StudentsList;
