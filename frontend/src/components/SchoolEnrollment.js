import React, { useState, useEffect } from 'react';

const SchoolEnrollment = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    student_first_name: '',
    student_last_name: '',
    student_middle_name: '',
    student_dob: '',
    requested_grade: '',
    requested_class: '',
    parent_message: ''
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      const response = await fetch(`${backendUrl}/api/work/organizations?type=EDUCATIONAL`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSchools(data.organizations || []);
      }
    } catch (err) {
      console.error('Error loading schools:', err);
    }
  };

  const handleSelectSchool = (school) => {
    setSelectedSchool(school);
    setShowForm(true);
    setSuccess(false);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedSchool) {
      setError('Выберите школу');
      return;
    }

    if (!formData.student_first_name || !formData.student_last_name || 
        !formData.student_dob || !formData.requested_grade) {
      setError('Заполните все обязательные поля');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      
      const response = await fetch(
        `${backendUrl}/api/work/organizations/${selectedSchool.id}/enrollment-requests`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      );

      if (response.ok) {
        setSuccess(true);
        setFormData({
          student_first_name: '',
          student_last_name: '',
          student_middle_name: '',
          student_dob: '',
          requested_grade: '',
          requested_class: '',
          parent_message: ''
        });
        setTimeout(() => {
          setShowForm(false);
          setSelectedSchool(null);
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Ошибка при отправке заявки');
      }
    } catch (err) {
      console.error('Error submitting enrollment:', err);
      setError('Ошибка при отправке заявки');
    } finally {
      setLoading(false);
    }
  };

  const grades = Array.from({ length: 11 }, (_, i) => i + 1);
  const classLetters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];

  return (
    <div className="school-enrollment">
      <div className="enrollment-header">
        <h1>Подача Заявки на Зачисление</h1>
        <p className="header-subtitle">Выберите школу и заполните заявку</p>
      </div>

      {!showForm ? (
        <div className="schools-list">
          <h2>Доступные Школы</h2>
          {schools.length === 0 ? (
            <div className="empty-state">
              <p>Нет доступных школ</p>
            </div>
          ) : (
            <div className="schools-grid">
              {schools.map((school) => (
                <div key={school.id} className="school-card">
                  <div className="school-card-header">
                    <h3>{school.name}</h3>
                    {school.school_type && (
                      <span className="school-type-badge">{school.school_type}</span>
                    )}
                  </div>
                  <div className="school-card-body">
                    {school.description && (
                      <p className="school-description">{school.description}</p>
                    )}
                    {school.school_address && (
                      <p className="school-info">
                        📍 {school.school_address}
                      </p>
                    )}
                    {school.grades_offered && school.grades_offered.length > 0 && (
                      <p className="school-info">
                        📚 Классы: {Math.min(...school.grades_offered)}-{Math.max(...school.grades_offered)}
                      </p>
                    )}
                  </div>
                  <div className="school-card-footer">
                    <button 
                      className="btn-primary"
                      onClick={() => handleSelectSchool(school)}
                    >
                      Подать Заявку
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="enrollment-form-container">
          <button 
            className="btn-back"
            onClick={() => {
              setShowForm(false);
              setSelectedSchool(null);
              setSuccess(false);
              setError(null);
            }}
          >
            ← Назад к списку школ
          </button>

          <div className="selected-school-info">
            <h3>Школа: {selectedSchool.name}</h3>
          </div>

          {success ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h2>Заявка отправлена!</h2>
              <p>Ваша заявка на зачисление была успешно отправлена. Администрация школы рассмотрит её в ближайшее время.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="enrollment-form">
              <h2>Данные Ребёнка</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>Фамилия *</label>
                  <input
                    type="text"
                    name="student_last_name"
                    value={formData.student_last_name}
                    onChange={handleInputChange}
                    placeholder="Иванов"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Имя *</label>
                  <input
                    type="text"
                    name="student_first_name"
                    value={formData.student_first_name}
                    onChange={handleInputChange}
                    placeholder="Иван"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Отчество</label>
                <input
                  type="text"
                  name="student_middle_name"
                  value={formData.student_middle_name}
                  onChange={handleInputChange}
                  placeholder="Петрович"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Дата Рождения *</label>
                  <input
                    type="date"
                    name="student_dob"
                    value={formData.student_dob}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Класс *</label>
                  <select
                    name="requested_grade"
                    value={formData.requested_grade}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Выберите класс</option>
                    {grades.map(grade => (
                      <option key={grade} value={grade}>{grade} класс</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Предпочитаемая Литера Класса</label>
                <select
                  name="requested_class"
                  value={formData.requested_class}
                  onChange={handleInputChange}
                >
                  <option value="">Не указано</option>
                  {classLetters.map(letter => (
                    <option key={letter} value={`${formData.requested_grade || ''}${letter}`}>
                      {letter}
                    </option>
                  ))}
                </select>
                <small>Например: А, Б, В (будет учтено при возможности)</small>
              </div>

              <div className="form-group">
                <label>Сообщение для Администрации</label>
                <textarea
                  name="parent_message"
                  value={formData.parent_message}
                  onChange={handleInputChange}
                  placeholder="Дополнительная информация о ребёнке или особые пожелания..."
                  rows="4"
                />
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedSchool(null);
                  }}
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Отправка...' : 'Отправить Заявку'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolEnrollment;
