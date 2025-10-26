import React, { useState } from 'react';
import { Megaphone, AlertCircle, Info, X, Building2, Users } from 'lucide-react';
import { getDepartmentsByOrg } from '../mock-work';

function WorkAnnouncementComposer({ organizationId, onClose, onSave, editingAnnouncement = null, moduleColor = '#C2410C' }) {
  const [formData, setFormData] = useState({
    title: editingAnnouncement?.title || '',
    content: editingAnnouncement?.content || '',
    priority: editingAnnouncement?.priority || 'NORMAL',
    target_type: editingAnnouncement?.target_type || 'ALL',
    target_departments: editingAnnouncement?.target_departments || [],
    is_pinned: editingAnnouncement?.is_pinned || false
  });

  const departments = getDepartmentsByOrg(organizationId);

  const priorities = [
    { value: 'NORMAL', label: 'Обычно', color: '#059669', bg: '#D1FAE5', icon: Info },
    { value: 'IMPORTANT', label: 'Важно', color: '#F59E0B', bg: '#FEF3C7', icon: AlertCircle },
    { value: 'URGENT', label: 'Срочно', color: '#DC2626', bg: '#FEE2E2', icon: AlertCircle }
  ];

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('Введите заголовок объявления');
      return;
    }
    if (!formData.content.trim()) {
      alert('Введите текст объявления');
      return;
    }
    if (formData.target_type === 'DEPARTMENTS' && formData.target_departments.length === 0) {
      alert('Выберите хотя бы один отдел');
      return;
    }

    onSave(formData);
  };

  const toggleDepartment = (deptId) => {
    setFormData(prev => ({
      ...prev,
      target_departments: prev.target_departments.includes(deptId)
        ? prev.target_departments.filter(id => id !== deptId)
        : [...prev.target_departments, deptId]
    }));
  };

  return (
    <div className="announcement-composer-overlay">
      <div className="announcement-composer-modal">
        <div className="composer-header">
          <div className="header-left">
            <div className="icon-badge" style={{ background: `${moduleColor}15`, color: moduleColor }}>
              <Megaphone size={24} />
            </div>
            <div>
              <h2>{editingAnnouncement ? 'Редактировать объявление' : 'Создать объявление'}</h2>
              <p>Важное сообщение для организации</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="composer-body">
          {/* Priority Selection */}
          <div className="form-section">
            <label className="section-label">Приоритет *</label>
            <div className="priority-options">
              {priorities.map((priority) => {
                const PriorityIcon = priority.icon;
                const isSelected = formData.priority === priority.value;
                return (
                  <button
                    key={priority.value}
                    className={`priority-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, priority: priority.value })}
                    style={{
                      background: isSelected ? priority.bg : 'white',
                      borderColor: isSelected ? priority.color : '#E4E6EB',
                      color: isSelected ? priority.color : '#65676B'
                    }}
                  >
                    <PriorityIcon size={20} />
                    <span>{priority.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="form-section">
            <label className="section-label">Заголовок *</label>
            <input
              type="text"
              className="title-input"
              placeholder="Например: Собрание всех сотрудников"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={100}
            />
            <span className="char-count">{formData.title.length}/100</span>
          </div>

          {/* Content */}
          <div className="form-section">
            <label className="section-label">Текст объявления *</label>
            <textarea
              className="content-textarea"
              placeholder="Подробное описание объявления...\n\nМожно использовать несколько строк для форматирования текста."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={6}
              maxLength={1000}
            />
            <span className="char-count">{formData.content.length}/1000</span>
          </div>

          {/* Target Audience */}
          <div className="form-section">
            <label className="section-label">Аудитория *</label>
            <div className="target-options">
              <button
                className={`target-option ${formData.target_type === 'ALL' ? 'selected' : ''}`}
                onClick={() => setFormData({ ...formData, target_type: 'ALL', target_departments: [] })}
                style={{
                  borderColor: formData.target_type === 'ALL' ? moduleColor : '#E4E6EB',
                  background: formData.target_type === 'ALL' ? `${moduleColor}10` : 'white'
                }}
              >
                <Building2 size={20} style={{ color: formData.target_type === 'ALL' ? moduleColor : '#65676B' }} />
                <div className="target-info">
                  <span className="target-label">Вся организация</span>
                  <span className="target-description">Все сотрудники увидят это объявление</span>
                </div>
              </button>

              <button
                className={`target-option ${formData.target_type === 'DEPARTMENTS' ? 'selected' : ''}`}
                onClick={() => setFormData({ ...formData, target_type: 'DEPARTMENTS' })}
                style={{
                  borderColor: formData.target_type === 'DEPARTMENTS' ? moduleColor : '#E4E6EB',
                  background: formData.target_type === 'DEPARTMENTS' ? `${moduleColor}10` : 'white'
                }}
              >
                <Users size={20} style={{ color: formData.target_type === 'DEPARTMENTS' ? moduleColor : '#65676B' }} />
                <div className="target-info">
                  <span className="target-label">Выбранные отделы</span>
                  <span className="target-description">Только члены выбранных отделов</span>
                </div>
              </button>
            </div>
          </div>

          {/* Department Selection */}
          {formData.target_type === 'DEPARTMENTS' && (
            <div className="form-section department-selection">
              <label className="section-label">Выберите отделы *</label>
              <div className="department-checkboxes">
                {departments.map((dept) => (
                  <label key={dept.id} className="department-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.target_departments.includes(dept.id)}
                      onChange={() => toggleDepartment(dept.id)}
                    />
                    <div className="dept-color-indicator" style={{ background: dept.color }} />
                    <span className="dept-name">{dept.name}</span>
                    <span className="dept-members">({dept.member_count} чел.)</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Pin Option */}
          <div className="form-section pin-section">
            <label className="pin-checkbox">
              <input
                type="checkbox"
                checked={formData.is_pinned}
                onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
              />
              <div className="pin-info">
                <span className="pin-label">📌 Закрепить объявление</span>
                <span className="pin-description">Закрепленные объявления показываются в начале ленты</span>
              </div>
            </label>
          </div>
        </div>

        <div className="composer-footer">
          <button className="btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            style={{ background: moduleColor }}
          >
            {editingAnnouncement ? 'Сохранить изменения' : 'Опубликовать объявление'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .announcement-composer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .announcement-composer-modal {
          background: white;
          border-radius: 12px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .composer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #E4E6EB;
        }

        .header-left {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .icon-badge {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-left h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #050505;
        }

        .header-left p {
          margin: 0.25rem 0 0;
          font-size: 0.875rem;
          color: #65676B;
        }

        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          color: #65676B;
          transition: color 0.2s;
        }

        .close-btn:hover {
          color: #050505;
        }

        .composer-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .form-section {
          margin-bottom: 1.5rem;
        }

        .section-label {
          display: block;
          margin-bottom: 0.75rem;
          font-weight: 600;
          color: #050505;
          font-size: 0.9375rem;
        }

        .priority-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        .priority-option {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          border: 2px solid;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
        }

        .priority-option:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .title-input,
        .content-textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
          font-size: 0.9375rem;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .title-input:focus,
        .content-textarea:focus {
          outline: none;
          border-color: #1D4ED8;
        }

        .content-textarea {
          resize: vertical;
          line-height: 1.6;
        }

        .char-count {
          display: block;
          text-align: right;
          font-size: 0.75rem;
          color: #65676B;
          margin-top: 0.25rem;
        }

        .target-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .target-option {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 2px solid;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          background: white;
        }

        .target-option:hover {
          transform: translateY(-1px);
        }

        .target-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .target-label {
          font-weight: 600;
          color: #050505;
          font-size: 0.9375rem;
        }

        .target-description {
          font-size: 0.8125rem;
          color: #65676B;
        }

        .department-selection {
          background: #F8F9FA;
          padding: 1rem;
          border-radius: 8px;
        }

        .department-checkboxes {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .department-checkbox {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .department-checkbox:hover {
          background: #F0F2F5;
        }

        .department-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .dept-color-indicator {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .dept-name {
          flex: 1;
          font-weight: 500;
          color: #050505;
        }

        .dept-members {
          font-size: 0.8125rem;
          color: #65676B;
        }

        .pin-section {
          background: #FEF3C7;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #FDE68A;
        }

        .pin-checkbox {
          display: flex;
          gap: 0.75rem;
          cursor: pointer;
        }

        .pin-checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
          margin-top: 2px;
        }

        .pin-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .pin-label {
          font-weight: 600;
          color: #92400E;
          font-size: 0.9375rem;
        }

        .pin-description {
          font-size: 0.8125rem;
          color: #92400E;
        }

        .composer-footer {
          display: flex;
          gap: 0.75rem;
          padding: 1.5rem;
          border-top: 1px solid #E4E6EB;
        }

        .btn-secondary,
        .btn-primary {
          flex: 1;
          padding: 0.875rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
          border: none;
        }

        .btn-secondary {
          background: #F0F2F5;
          color: #050505;
        }

        .btn-primary {
          color: white;
        }

        .btn-secondary:hover,
        .btn-primary:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}

export default WorkAnnouncementComposer;