import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, X, Edit2, Save } from 'lucide-react';
import { toast } from '../utils/animations';

const ChildrenSection = ({ user, moduleColor = '#1E40AF' }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChildId, setEditingChildId] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    date_of_birth: '',
    grade: '',
    school_name: '',
    notes: ''
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchChildren();
  }, []);


  const fetchChildren = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/users/me/children`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(data);
      }
    } catch (error) {
      console.error('Error fetching children:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      middle_name: '',
      date_of_birth: '',
      grade: '',
      school_name: '',
      notes: ''
    });
    setShowAddForm(false);
    setEditingChildId(null);
  };

  const getAgeFromDOB = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getAgeText = (age) => {
    if (!age) return '';
    const lastDigit = age % 10;
    const lastTwoDigits = age % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return `${age} лет`;
    }
    if (lastDigit === 1) {
      return `${age} год`;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${age} года`;
    }
    return `${age} лет`;
  };

  const handleSaveChild = async () => {
    try {
      // Validate required fields
      if (!formData.first_name || !formData.last_name || !formData.date_of_birth) {
        toast.warning('Пожалуйста, заполните обязательные поля: Имя, Фамилия и Дата Рождения');
        return;
      }

      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${BACKEND_URL}/api/users/me/children`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Информация о ребёнке успешно сохранена!');
        resetForm();
        fetchChildren(); // Reload the list
      } else {
        const error = await response.json();
        toast.error(`Ошибка: ${error.detail || 'Не удалось сохранить данные'}`);
      }
    } catch (error) {
      console.error('Error saving child:', error);
      toast.error('Произошла ошибка при сохранении данных');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="info-section">
        <div className="section-header">
          <h2>
            <Users size={20} />
            Мои Дети
          </h2>
        </div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="info-section children-section">
      <div className="section-header">
        <h2>
          <Users size={20} />
          Мои Дети
        </h2>
        <button 
          className="btn-icon btn-add"
          style={{ color: moduleColor }}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X size={18} /> : <Plus size={18} />}
          {showAddForm ? 'Отмена' : 'Добавить'}
        </button>
      </div>

      <p className="section-description">
        Информация о ваших детях. Эти данные используются для записи в школы и управления учебным процессом.
      </p>

      {showAddForm && (
        <div className="add-child-form">
          <h3>Добавить Информацию о Ребёнке</h3>
          <p className="form-note">
            Примечание: Эта форма для ввода базовой информации. Для официальной записи в школу используйте форму &ldquo;Подать Заявку&rdquo; в модуле ШКОЛА.
          </p>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Фамилия *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Иванов"
              />
            </div>

            <div className="form-group">
              <label>Имя *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="Иван"
              />
            </div>

            <div className="form-group">
              <label>Отчество</label>
              <input
                type="text"
                name="middle_name"
                value={formData.middle_name}
                onChange={handleInputChange}
                placeholder="Петрович"
              />
            </div>

            <div className="form-group">
              <label>Дата Рождения *</label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Класс</label>
              <select
                name="grade"
                value={formData.grade}
                onChange={handleInputChange}
              >
                <option value="">Выберите класс</option>
                {Array.from({ length: 11 }, (_, i) => i + 1).map(grade => (
                  <option key={grade} value={grade}>{grade} класс</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Школа</label>
              <input
                type="text"
                name="school_name"
                value={formData.school_name}
                onChange={handleInputChange}
                placeholder="Название школы"
              />
            </div>

            <div className="form-group full-width">
              <label>Примечания</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Дополнительная информация..."
                rows="3"
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={resetForm} disabled={loading}>
              Отмена
            </button>
            <button 
              className="btn-primary" 
              style={{ backgroundColor: moduleColor }}
              onClick={handleSaveChild}
              disabled={loading}
            >
              <Save size={16} />
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {children.length === 0 ? (
        <div className="empty-state-small">
          <Users size={32} style={{ color: moduleColor, opacity: 0.5 }} />
          <p>Нет информации о детях</p>
          <p className="empty-hint">Добавьте информацию о ваших детях для удобного управления</p>
        </div>
      ) : (
        <div className="children-list">
          {children.map((child) => (
            <div key={child.student_id} className="child-item">
              <div className="child-avatar" style={{ background: `${moduleColor}20`, color: moduleColor }}>
                {child.student_first_name[0]}{child.student_last_name[0]}
              </div>
              <div className="child-details">
                <div className="child-name">
                  {child.student_last_name} {child.student_first_name} 
                  {child.student_middle_name && ` ${child.student_middle_name}`}
                </div>
                <div className="child-meta">
                  {child.age && getAgeText(child.age)} • 
                  {child.grade && ` ${child.grade} класс`}
                  {child.assigned_class && ` ${child.assigned_class}`}
                  {child.academic_status && (
                    <span className={`status-badge-small status-${child.academic_status.toLowerCase()}`}>
                      {child.academic_status === 'ACTIVE' ? 'Учится' : child.academic_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChildrenSection;
