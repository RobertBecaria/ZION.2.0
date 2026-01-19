import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, ChevronLeft, TrendingUp, Calendar, User, FileText, Award } from 'lucide-react';
import { toast } from '../utils/animations';

const StudentGradebook = ({ selectedSchool, role, onBack }) => {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [showAddGradeModal, setShowAddGradeModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const GRADE_TYPES = [
    { value: 'EXAM', label: 'Контрольная работа' },
    { value: 'QUIZ', label: 'Самостоятельная работа' },
    { value: 'HOMEWORK', label: 'Домашняя работа' },
    { value: 'CLASSWORK', label: 'Работа на уроке' },
    { value: 'TEST', label: 'Тест' },
    { value: 'ORAL', label: 'Устный ответ' },
    { value: 'PROJECT', label: 'Проект' }
  ];

  const ACADEMIC_PERIODS = [
    { value: 'QUARTER_1', label: '1 четверть' },
    { value: 'QUARTER_2', label: '2 четверть' },
    { value: 'QUARTER_3', label: '3 четверть' },
    { value: 'QUARTER_4', label: '4 четверть' }
  ];

  const [newGrade, setNewGrade] = useState({
    student_id: '',
    subject: '',
    grade_value: 5,
    grade_type: 'CLASSWORK',
    academic_period: 'QUARTER_1',
    date: new Date().toISOString().split('T')[0],
    comment: '',
    weight: 1
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (role === 'parent') {
      fetchChildren();
    } else if (role === 'teacher') {
      fetchTeacherStudents();
    }
  }, [role, selectedSchool]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedChild) {
      fetchGrades(selectedChild.student_id);
    }
  }, [selectedChild, selectedSubject, selectedPeriod]);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/users/me/children`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const schoolChildren = data.filter(child => 
          child.organization_id === selectedSchool.organization_id
        );
        setChildren(schoolChildren);
        
        if (schoolChildren.length > 0) {
          setSelectedChild(schoolChildren[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherStudents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      // Get all students in this organization
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
        
        if (data.length > 0) {
          setSelectedStudent(data[0]);
          fetchGrades(data[0].student_id);
        }
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGrades = async (studentId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      let url = `${BACKEND_URL}/api/work/organizations/${selectedSchool.organization_id}/students/${studentId}/grades`;
      const params = [];
      
      if (selectedSubject !== 'all') {
        params.push(`subject=${encodeURIComponent(selectedSubject)}`);
      }
      if (selectedPeriod !== 'all') {
        params.push(`academic_period=${selectedPeriod}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGrades(data);
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGrade = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${selectedSchool.organization_id}/grades`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newGrade)
        }
      );

      if (response.ok) {
        toast.success('Оценка успешно добавлена!');
        setShowAddGradeModal(false);
        fetchGrades(newGrade.student_id);
        // Reset form
        setNewGrade({
          student_id: '',
          subject: '',
          grade_value: 5,
          grade_type: 'CLASSWORK',
          academic_period: 'QUARTER_1',
          date: new Date().toISOString().split('T')[0],
          comment: '',
          weight: 1
        });
      } else {
        const error = await response.json();
        toast.error(`Ошибка: ${error.detail || 'Не удалось добавить оценку'}`);
      }
    } catch (error) {
      console.error('Error adding grade:', error);
      toast.error('Произошла ошибка при добавлении оценки');
    }
  };

  const getGradeColor = (value) => {
    if (value === 5) return '#10b981'; // green
    if (value === 4) return '#3b82f6'; // blue
    if (value === 3) return '#f59e0b'; // orange
    return '#ef4444'; // red
  };

  const getGradeLabel = (value) => {
    if (value === 5) return 'Отлично';
    if (value === 4) return 'Хорошо';
    if (value === 3) return 'Удовлетворительно';
    if (value === 2) return 'Неудовлетворительно';
    return 'Очень плохо';
  };

  const calculateAverage = () => {
    if (grades.length === 0) return null;
    const totalWeighted = grades.reduce((sum, g) => sum + (g.grade_value * g.weight), 0);
    const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0);
    return (totalWeighted / totalWeight).toFixed(2);
  };

  const getUniqueSubjects = () => {
    return [...new Set(grades.map(g => g.subject))];
  };

  if (loading && grades.length === 0) {
    return (
      <div className="gradebook-container">
        <div className="loading-state">
          <p>Загрузка оценок...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gradebook-container">
      <div className="gradebook-header">
        <button className="btn-back" onClick={onBack}>
          <ChevronLeft size={20} />
          Назад
        </button>
        <div>
          <h1>
            <BookOpen size={24} />
            {role === 'parent' ? 'Электронный Дневник' : 'Журнал Оценок'}
          </h1>
          <p className="gradebook-subtitle">
            {selectedSchool.organization_name}
          </p>
        </div>
        {role === 'teacher' && (
          <button 
            className="btn-primary"
            onClick={() => setShowAddGradeModal(true)}
          >
            <Plus size={18} />
            Добавить Оценку
          </button>
        )}
      </div>

      {/* Child/Student Selector */}
      {role === 'parent' && children.length > 0 && (
        <div className="selector-section">
          <label>Выберите ребёнка:</label>
          <select 
            value={selectedChild?.student_id || ''}
            onChange={(e) => {
              const child = children.find(c => c.student_id === e.target.value);
              setSelectedChild(child);
            }}
          >
            {children.map(child => (
              <option key={child.student_id} value={child.student_id}>
                {child.student_last_name} {child.student_first_name} - {child.grade} {child.assigned_class}
              </option>
            ))}
          </select>
        </div>
      )}

      {role === 'teacher' && students.length > 0 && (
        <div className="selector-section">
          <label>Выберите ученика:</label>
          <select 
            value={selectedStudent?.student_id || ''}
            onChange={(e) => {
              const student = students.find(s => s.student_id === e.target.value);
              setSelectedStudent(student);
              fetchGrades(e.target.value);
            }}
          >
            {students.map(student => (
              <option key={student.student_id} value={student.student_id}>
                {student.student_last_name} {student.student_first_name} - {student.grade} {student.assigned_class}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filters */}
      <div className="gradebook-filters">
        <div className="filter-group">
          <label>Предмет:</label>
          <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
            <option value="all">Все предметы</option>
            {getUniqueSubjects().map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Период:</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            <option value="all">Все периоды</option>
            {ACADEMIC_PERIODS.map(period => (
              <option key={period.value} value={period.value}>{period.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics */}
      {grades.length > 0 && (
        <div className="grade-statistics">
          <div className="stat-card">
            <Award size={24} />
            <div>
              <div className="stat-label">Средний Балл</div>
              <div className="stat-value">{calculateAverage()}</div>
            </div>
          </div>
          <div className="stat-card">
            <FileText size={24} />
            <div>
              <div className="stat-label">Всего Оценок</div>
              <div className="stat-value">{grades.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Grades List */}
      {grades.length === 0 ? (
        <div className="empty-state-large">
          <BookOpen size={48} style={{ color: '#6D28D9', opacity: 0.5 }} />
          <h3>Оценок Нет</h3>
          <p>
            {role === 'parent' 
              ? 'У выбранного ребёнка пока нет оценок'
              : 'У выбранного ученика пока нет оценок'}
          </p>
        </div>
      ) : (
        <div className="grades-list">
          {grades.map(grade => (
            <div key={grade.grade_id} className="grade-card">
              <div className="grade-header">
                <div className="grade-badge" style={{ backgroundColor: getGradeColor(grade.grade_value) }}>
                  {grade.grade_value}
                </div>
                <div className="grade-info">
                  <div className="grade-subject">{grade.subject}</div>
                  <div className="grade-type">
                    {GRADE_TYPES.find(t => t.value === grade.grade_type)?.label || grade.grade_type}
                  </div>
                </div>
                <div className="grade-meta">
                  <div className="grade-date">
                    <Calendar size={14} />
                    {new Date(grade.date).toLocaleDateString('ru-RU')}
                  </div>
                  <div className="grade-period">
                    {ACADEMIC_PERIODS.find(p => p.value === grade.academic_period)?.label || grade.academic_period}
                  </div>
                </div>
              </div>
              
              {grade.teacher_name && (
                <div className="grade-teacher">
                  <User size={14} />
                  {grade.teacher_name}
                </div>
              )}
              
              {grade.comment && (
                <div className="grade-comment">
                  <FileText size={14} />
                  {grade.comment}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Grade Modal (Teacher only) */}
      {showAddGradeModal && role === 'teacher' && (
        <div className="modal-overlay" onClick={() => setShowAddGradeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Добавить Оценку</h2>
              <button className="modal-close" onClick={() => setShowAddGradeModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Ученик:</label>
                <select 
                  value={newGrade.student_id}
                  onChange={(e) => setNewGrade({...newGrade, student_id: e.target.value})}
                >
                  <option value="">Выберите ученика</option>
                  {students.map(student => (
                    <option key={student.student_id} value={student.student_id}>
                      {student.student_last_name} {student.student_first_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Предмет:</label>
                <input 
                  type="text"
                  value={newGrade.subject}
                  onChange={(e) => setNewGrade({...newGrade, subject: e.target.value})}
                  placeholder="Математика"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Оценка (1-5):</label>
                  <select 
                    value={newGrade.grade_value}
                    onChange={(e) => setNewGrade({...newGrade, grade_value: parseInt(e.target.value)})}
                  >
                    <option value={5}>5 - Отлично</option>
                    <option value={4}>4 - Хорошо</option>
                    <option value={3}>3 - Удовлетворительно</option>
                    <option value={2}>2 - Неудовлетворительно</option>
                    <option value={1}>1 - Очень плохо</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Дата:</label>
                  <input 
                    type="date"
                    value={newGrade.date}
                    onChange={(e) => setNewGrade({...newGrade, date: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Тип работы:</label>
                  <select 
                    value={newGrade.grade_type}
                    onChange={(e) => setNewGrade({...newGrade, grade_type: e.target.value})}
                  >
                    {GRADE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Период:</label>
                  <select 
                    value={newGrade.academic_period}
                    onChange={(e) => setNewGrade({...newGrade, academic_period: e.target.value})}
                  >
                    {ACADEMIC_PERIODS.map(period => (
                      <option key={period.value} value={period.value}>{period.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Комментарий (необязательно):</label>
                <textarea 
                  value={newGrade.comment}
                  onChange={(e) => setNewGrade({...newGrade, comment: e.target.value})}
                  placeholder="Дополнительная информация об оценке"
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddGradeModal(false)}>
                Отмена
              </button>
              <button 
                className="btn-primary" 
                onClick={handleAddGrade}
                disabled={!newGrade.student_id || !newGrade.subject}
              >
                Добавить Оценку
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentGradebook;
