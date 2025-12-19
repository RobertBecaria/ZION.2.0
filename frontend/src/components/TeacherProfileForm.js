import React, { useState, useEffect } from 'react';
import { 
  BookOpen, GraduationCap, Users, Award, CheckCircle, 
  X, ChevronDown, Search, User
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;

function TeacherProfileForm({ organizationId, onClose, onSave, moduleColor = '#ea580c' }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolConstants, setSchoolConstants] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  
  const [formData, setFormData] = useState({
    is_teacher: true,
    teaching_subjects: [],
    teaching_grades: [],
    is_class_supervisor: false,
    supervised_class: '',
    teacher_qualification: '',
    job_title: ''
  });
  
  const [subjectSearch, setSubjectSearch] = useState('');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchSchoolConstants();
    fetchCurrentMember();
  }, []);

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

  const fetchCurrentMember = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentMember(data);
        
        // Pre-fill form if teacher data exists
        if (data.is_teacher) {
          setFormData({
            is_teacher: true,
            teaching_subjects: data.teaching_subjects || [],
            teaching_grades: data.teaching_grades || [],
            is_class_supervisor: data.is_class_supervisor || false,
            supervised_class: data.supervised_class || '',
            teacher_qualification: data.teacher_qualification || '',
            job_title: data.job_title || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching member:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${organizationId}/teachers/me`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      );

      if (response.ok) {
        onSave?.();
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при сохранении профиля');
      }
    } catch (error) {
      console.error('Error saving teacher profile:', error);
      alert('Ошибка при сохранении профиля');
    } finally {
      setSaving(false);
    }
  };

  const toggleSubject = (subject) => {
    setFormData(prev => ({
      ...prev,
      teaching_subjects: prev.teaching_subjects.includes(subject)
        ? prev.teaching_subjects.filter(s => s !== subject)
        : [...prev.teaching_subjects, subject]
    }));
  };

  const toggleGrade = (grade) => {
    setFormData(prev => ({
      ...prev,
      teaching_grades: prev.teaching_grades.includes(grade)
        ? prev.teaching_grades.filter(g => g !== grade)
        : [...prev.teaching_grades, grade].sort((a, b) => a - b)
    }));
  };

  const getGradeRangeLabel = () => {
    if (formData.teaching_grades.length === 0) return 'Не выбраны';
    const sorted = [...formData.teaching_grades].sort((a, b) => a - b);
    if (sorted.length === 1) return `${sorted[0]} класс`;
    
    // Check for consecutive ranges
    let ranges = [];
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    
    return ranges.join(', ') + ' классы';
  };

  const filteredSubjects = schoolConstants?.subjects.filter(subject =>
    subject.toLowerCase().includes(subjectSearch.toLowerCase())
  ) || [];

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content teacher-form-modal">
          <div className="loading-state">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content teacher-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottomColor: moduleColor }}>
          <div className="modal-title">
            <GraduationCap size={24} style={{ color: moduleColor }} />
            <h2>Профиль Учителя</h2>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body teacher-form">
          {/* Job Title */}
          <div className="form-group">
            <label>
              <User size={18} />
              <span>Должность</span>
            </label>
            <input
              type="text"
              value={formData.job_title}
              onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
              placeholder="Учитель математики"
              className="form-input"
            />
          </div>

          {/* Teaching Subjects */}
          <div className="form-group">
            <label>
              <BookOpen size={18} />
              <span>Предметы</span>
              <span className="required">*</span>
            </label>
            
            <div className="subject-selector">
              <div className="search-box" style={{ borderColor: showSubjectDropdown ? moduleColor : '#e5e7eb' }}>
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Поиск предметов..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  onFocus={() => setShowSubjectDropdown(true)}
                />
                <ChevronDown size={18} className={showSubjectDropdown ? 'rotated' : ''} />
              </div>

              {showSubjectDropdown && (
                <div className="subject-dropdown">
                  <div className="dropdown-header">
                    <span>Выберите предметы</span>
                    <button 
                      type="button"
                      onClick={() => setShowSubjectDropdown(false)}
                      className="close-dropdown-btn"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="subject-list">
                    {filteredSubjects.map((subject) => (
                      <button
                        key={subject}
                        type="button"
                        className={`subject-item ${formData.teaching_subjects.includes(subject) ? 'selected' : ''}`}
                        onClick={() => toggleSubject(subject)}
                        style={{
                          borderColor: formData.teaching_subjects.includes(subject) ? moduleColor : '#e5e7eb',
                          background: formData.teaching_subjects.includes(subject) ? `${moduleColor}15` : 'white'
                        }}
                      >
                        {formData.teaching_subjects.includes(subject) && (
                          <CheckCircle size={16} style={{ color: moduleColor }} />
                        )}
                        <span>{subject}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Subjects Tags */}
              {formData.teaching_subjects.length > 0 && (
                <div className="selected-tags">
                  {formData.teaching_subjects.map((subject) => (
                    <span 
                      key={subject} 
                      className="tag"
                      style={{ backgroundColor: moduleColor, color: 'white' }}
                    >
                      {subject}
                      <button
                        type="button"
                        onClick={() => toggleSubject(subject)}
                        className="tag-remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Teaching Grades */}
          <div className="form-group">
            <label>
              <Users size={18} />
              <span>Классы</span>
              <span className="required">*</span>
            </label>
            <p className="form-hint">{getGradeRangeLabel()}</p>
            
            <div className="grade-grid">
              {schoolConstants?.grades.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  className={`grade-btn ${formData.teaching_grades.includes(grade) ? 'selected' : ''}`}
                  onClick={() => toggleGrade(grade)}
                  style={{
                    backgroundColor: formData.teaching_grades.includes(grade) ? moduleColor : 'white',
                    borderColor: formData.teaching_grades.includes(grade) ? moduleColor : '#e5e7eb',
                    color: formData.teaching_grades.includes(grade) ? 'white' : '#1a1a1a'
                  }}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Class Supervisor */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_class_supervisor}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  is_class_supervisor: e.target.checked,
                  supervised_class: e.target.checked ? formData.supervised_class : ''
                })}
              />
              <span>Я классный руководитель</span>
            </label>
          </div>

          {formData.is_class_supervisor && (
            <div className="form-group animated-slide-down">
              <label>
                <Users size={18} />
                <span>Класс</span>
              </label>
              <input
                type="text"
                value={formData.supervised_class}
                onChange={(e) => setFormData({ ...formData, supervised_class: e.target.value })}
                placeholder="5А, 7Б, 11В..."
                className="form-input"
              />
              <p className="form-hint">Например: 5А, 7Б, 11В</p>
            </div>
          )}

          {/* Qualification */}
          <div className="form-group">
            <label>
              <Award size={18} />
              <span>Квалификация</span>
            </label>
            <select
              value={formData.teacher_qualification}
              onChange={(e) => setFormData({ ...formData, teacher_qualification: e.target.value })}
              className="form-select"
            >
              <option value="">Не указана</option>
              <option value="Без категории">Без категории</option>
              <option value="Первая категория">Первая категория</option>
              <option value="Высшая категория">Высшая категория</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ backgroundColor: moduleColor }}
              disabled={saving || formData.teaching_subjects.length === 0 || formData.teaching_grades.length === 0}
            >
              {saving ? 'Сохранение...' : 'Сохранить профиль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeacherProfileForm;
