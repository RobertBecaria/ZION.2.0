import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, MapPin, ChevronLeft } from 'lucide-react';

const ClassSchedule = ({ selectedSchool, role, onBack }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const DAYS = [
    { key: 'MONDAY', label: 'Понедельник' },
    { key: 'TUESDAY', label: 'Вторник' },
    { key: 'WEDNESDAY', label: 'Среда' },
    { key: 'THURSDAY', label: 'Четверг' },
    { key: 'FRIDAY', label: 'Пятница' },
    { key: 'SATURDAY', label: 'Суббота' }
  ];

  const LESSON_TIMES = [
    { number: 1, start: '08:00', end: '08:45' },
    { number: 2, start: '08:55', end: '09:40' },
    { number: 3, start: '10:00', end: '10:45' },
    { number: 4, start: '11:05', end: '11:50' },
    { number: 5, start: '12:10', end: '12:55' },
    { number: 6, start: '13:05', end: '13:50' },
    { number: 7, start: '14:00', end: '14:45' }
  ];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (role === 'parent') {
      fetchChildren();
    } else if (role === 'teacher') {
      fetchTeacherSchedule();
    }
  }, [role, selectedSchool]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedChild) {
      fetchSchedule(selectedChild.grade, selectedChild.assigned_class);
    }
  }, [selectedChild]);

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
        // Filter children in this school
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

  const fetchTeacherSchedule = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      // For teacher, fetch all schedules where they are the teacher
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${selectedSchool.organization_id}/schedules`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedule = async (grade, assignedClass) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${selectedSchool.organization_id}/schedules?grade=${grade}&assigned_class=${assignedClass}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScheduleForDayAndLesson = (day, lessonNumber) => {
    return schedules.find(s => s.day_of_week === day && s.lesson_number === lessonNumber);
  };

  if (loading) {
    return (
      <div className="schedule-container">
        <div className="loading-state">
          <p>Загрузка расписания...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <button className="btn-back" onClick={onBack}>
          <ChevronLeft size={20} />
          Назад
        </button>
        <div>
          <h1>
            <Calendar size={24} />
            Расписание Уроков
          </h1>
          <p className="schedule-subtitle">
            {selectedSchool.organization_name}
          </p>
        </div>
      </div>

      {/* Child Selector for Parents */}
      {role === 'parent' && children.length > 0 && (
        <div className="child-selector">
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

      {/* Teacher Info */}
      {role === 'teacher' && (
        <div className="teacher-info-banner">
          <p>Ваше расписание преподавания</p>
        </div>
      )}

      {/* Schedule Grid */}
      {schedules.length === 0 ? (
        <div className="empty-state-large">
          <Calendar size={48} style={{ color: '#6D28D9', opacity: 0.5 }} />
          <h3>Расписание Не Найдено</h3>
          <p>
            {role === 'parent' 
              ? 'Расписание для выбранного ребёнка ещё не создано'
              : 'У вас пока нет расписания в этой школе'}
          </p>
        </div>
      ) : (
        <div className="schedule-grid">
          <div className="schedule-table">
            {/* Header Row */}
            <div className="schedule-row schedule-header-row">
              <div className="schedule-cell time-cell">
                <Clock size={16} />
                Время
              </div>
              {DAYS.map(day => (
                <div key={day.key} className="schedule-cell day-header-cell">
                  {day.label}
                </div>
              ))}
            </div>

            {/* Lesson Rows */}
            {LESSON_TIMES.map(lesson => (
              <div key={lesson.number} className="schedule-row">
                <div className="schedule-cell time-cell">
                  <div className="lesson-number">{lesson.number}</div>
                  <div className="lesson-time">
                    {lesson.start} - {lesson.end}
                  </div>
                </div>
                {DAYS.map(day => {
                  const schedule = getScheduleForDayAndLesson(day.key, lesson.number);
                  return (
                    <div key={day.key} className="schedule-cell lesson-cell">
                      {schedule ? (
                        <div className="lesson-card">
                          <div className="lesson-subject">{schedule.subject}</div>
                          {schedule.teacher_name && (
                            <div className="lesson-teacher">
                              <User size={14} />
                              {schedule.teacher_name}
                            </div>
                          )}
                          {schedule.classroom && (
                            <div className="lesson-classroom">
                              <MapPin size={14} />
                              {schedule.classroom}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="lesson-empty">-</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassSchedule;
