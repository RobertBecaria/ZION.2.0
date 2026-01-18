import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, BookOpen, Users, Award, Search, Filter,
  Mail, Calendar, Star, ChevronDown, X
} from 'lucide-react';


import { BACKEND_URL } from '../config/api';
const TeacherDirectory = React.memo(function TeacherDirectory({ organizationId, moduleColor = '#ea580c', onEditProfile }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolConstants, setSchoolConstants] = useState(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchSchoolConstants();
    fetchTeachers();
  }, [organizationId, selectedGrade, selectedSubject]);

  const fetchSchoolConstants = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/work/schools/constants`);
      if (response.ok) {
        const data = await response.json();
        setSchoolConstants(data);
      }
    } catch (error) {
      console.error('Error fetching school constants:', error);
    }
  };

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      let url = `${BACKEND_URL}/api/work/organizations/${organizationId}/teachers`;
      
      const params = new URLSearchParams();
      if (selectedGrade) params.append('grade', selectedGrade);
      if (selectedSubject) params.append('subject', selectedSubject);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTeachers(data);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeachers = teachers.filter(teacher => {
    const fullName = `${teacher.user_first_name} ${teacher.user_last_name}`.toLowerCase();
    const jobTitle = (teacher.job_title || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    
    return fullName.includes(query) || jobTitle.includes(query);
  });

  const clearFilters = () => {
    setSelectedGrade(null);
    setSelectedSubject(null);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedGrade || selectedSubject || searchQuery;

  const getTeacherInitials = (teacher) => {
    return `${teacher.user_first_name[0]}${teacher.user_last_name[0]}`;
  };

  const getGradeRangeLabel = (grades) => {
    if (!grades || grades.length === 0) return '';
    const sorted = [...grades].sort((a, b) => a - b);
    if (sorted.length === 1) return `${sorted[0]} класс`;
    return `${sorted[0]}-${sorted[sorted.length - 1]} классы`;
  };

  return (
    <div className="teacher-directory">
      {/* Header with Search and Filters */}
      <div className="directory-header">
        <div className="header-title">
          <GraduationCap size={28} style={{ color: moduleColor }} />
          <div>
            <h2>Преподавательский состав</h2>
            <p>{teachers.length} {teachers.length === 1 ? 'учитель' : teachers.length < 5 ? 'учителя' : 'учителей'}</p>
          </div>
        </div>

        <button 
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
          style={{ borderColor: showFilters ? moduleColor : '#e5e7eb' }}
        >
          <Filter size={18} />
          <span>Фильтры</span>
          {hasActiveFilters && <span className="filter-badge" style={{ backgroundColor: moduleColor }}>•</span>}
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-container">
        <Search size={20} />
        <input
          type="text"
          placeholder="Поиск по имени или должности..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="clear-search-btn">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-section">
            <label>
              <Users size={16} />
              <span>Класс</span>
            </label>
            <div className="filter-options">
              {schoolConstants?.grades.map((grade) => (
                <button
                  key={grade}
                  className={`filter-chip ${selectedGrade === grade ? 'active' : ''}`}
                  onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
                  style={{
                    backgroundColor: selectedGrade === grade ? moduleColor : 'white',
                    borderColor: selectedGrade === grade ? moduleColor : '#e5e7eb',
                    color: selectedGrade === grade ? 'white' : '#1a1a1a'
                  }}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label>
              <BookOpen size={16} />
              <span>Предмет</span>
            </label>
            <select
              value={selectedSubject || ''}
              onChange={(e) => setSelectedSubject(e.target.value || null)}
              className="filter-select"
            >
              <option value="">Все предметы</option>
              {schoolConstants?.subjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="clear-filters-btn">
              <X size={16} />
              <span>Очистить фильтры</span>
            </button>
          )}
        </div>
      )}

      {/* Teachers Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Загрузка преподавателей...</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="empty-state">
          <GraduationCap size={48} style={{ color: '#d1d5db' }} />
          <h3>Учителя не найдены</h3>
          <p>Попробуйте изменить параметры поиска</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-secondary">
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="teachers-grid">
          {filteredTeachers.map((teacher) => (
            <div key={teacher.id} className="teacher-card">
              {/* Avatar */}
              <div className="teacher-avatar" style={{ background: `linear-gradient(135deg, ${moduleColor} 0%, ${moduleColor}dd 100%)` }}>
                {teacher.user_avatar_url ? (
                  <img src={teacher.user_avatar_url} alt={teacher.user_first_name} />
                ) : (
                  <span>{getTeacherInitials(teacher)}</span>
                )}
              </div>

              {/* Info */}
              <div className="teacher-info">
                <h3>{teacher.user_first_name} {teacher.user_last_name}</h3>
                
                {teacher.job_title && (
                  <p className="job-title">{teacher.job_title}</p>
                )}

                {/* Badges */}
                <div className="teacher-badges">
                  {teacher.is_class_supervisor && teacher.supervised_class && (
                    <span className="badge supervisor-badge" style={{ backgroundColor: `${moduleColor}20`, color: moduleColor }}>
                      <Star size={14} />
                      Кл. рук. {teacher.supervised_class}
                    </span>
                  )}
                  
                  {teacher.teacher_qualification && (
                    <span className="badge qualification-badge">
                      <Award size={14} />
                      {teacher.teacher_qualification}
                    </span>
                  )}
                </div>

                {/* Subjects */}
                {teacher.teaching_subjects.length > 0 && (
                  <div className="teacher-subjects">
                    <BookOpen size={14} style={{ color: moduleColor }} />
                    <div className="subject-tags">
                      {teacher.teaching_subjects.slice(0, 3).map((subject) => (
                        <span key={subject} className="subject-tag" style={{ borderColor: moduleColor, color: moduleColor }}>
                          {subject}
                        </span>
                      ))}
                      {teacher.teaching_subjects.length > 3 && (
                        <span className="more-subjects">+{teacher.teaching_subjects.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Grades */}
                {teacher.teaching_grades.length > 0 && (
                  <div className="teacher-grades">
                    <Users size={14} />
                    <span>{getGradeRangeLabel(teacher.teaching_grades)}</span>
                  </div>
                )}

                {/* Contact */}
                <div className="teacher-contact">
                  <Mail size={14} />
                  <a href={`mailto:${teacher.user_email}`}>{teacher.user_email}</a>
                </div>

                {/* Start Date */}
                {teacher.start_date && (
                  <div className="teacher-meta">
                    <Calendar size={14} />
                    <span>С {new Date(teacher.start_date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default TeacherDirectory;
