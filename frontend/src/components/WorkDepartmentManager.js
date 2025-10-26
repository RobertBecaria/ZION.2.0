import React, { useState } from 'react';
import { Building2, Users, Edit3, Trash2, Plus, UserPlus, X } from 'lucide-react';
import { getDepartmentsByOrg, mockWorkUsers } from '../mock-work';

function WorkDepartmentManager({ organizationId, onClose, moduleColor = '#C2410C' }) {
  const [departments, setDepartments] = useState(getDepartmentsByOrg(organizationId));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#1D4ED8',
    head_id: ''
  });

  const colorOptions = [
    { color: '#1D4ED8', name: 'Синий' },
    { color: '#059669', name: 'Зеленый' },
    { color: '#7E22CE', name: 'Фиолетовый' },
    { color: '#A16207', name: 'Желтый' },
    { color: '#BE185D', name: 'Розовый' },
    { color: '#DC2626', name: 'Красный' },
    { color: '#EA580C', name: 'Оранжевый' },
    { color: '#0891B2', name: 'Голубой' }
  ];

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      color: '#1D4ED8',
      head_id: ''
    });
    setEditingDepartment(null);
    setShowCreateModal(true);
  };

  const handleEdit = (department) => {
    setFormData({
      name: department.name,
      description: department.description,
      color: department.color,
      head_id: department.head_id
    });
    setEditingDepartment(department);
    setShowCreateModal(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Введите название отдела');
      return;
    }

    if (editingDepartment) {
      // Update existing
      setDepartments(departments.map(d => 
        d.id === editingDepartment.id 
          ? { ...d, ...formData }
          : d
      ));
      alert('Отдел обновлен!');
    } else {
      // Create new
      const newDept = {
        id: `dept-${Date.now()}`,
        organization_id: organizationId,
        ...formData,
        member_count: 0,
        created_at: new Date().toISOString()
      };
      setDepartments([...departments, newDept]);
      alert('Отдел создан!');
    }

    setShowCreateModal(false);
  };

  const handleDelete = (departmentId) => {
    if (window.confirm('Удалить этот отдел?')) {
      setDepartments(departments.filter(d => d.id !== departmentId));
      alert('Отдел удален');
    }
  };

  return (
    <div className="department-manager-overlay">
      <div className="department-manager-modal">
        <div className="modal-header">
          <div className="header-left">
            <Building2 size={24} style={{ color: moduleColor }} />
            <div>
              <h2>Управление отделами</h2>
              <p>{departments.length} отдел(ов)</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-actions">
          <button
            className="create-dept-btn"
            onClick={handleCreate}
            style={{ background: moduleColor }}
          >
            <Plus size={18} />
            Создать отдел
          </button>
        </div>

        <div className="departments-grid">
          {departments.length === 0 ? (
            <div className="empty-state">
              <Building2 size={48} style={{ color: '#BCC0C4' }} />
              <p>Нет отделов. Создайте первый!</p>
            </div>
          ) : (
            departments.map((dept) => {
              const head = mockWorkUsers.find(u => u.id === dept.head_id);
              return (
                <div key={dept.id} className="department-card">
                  <div className="dept-card-header" style={{ borderTop: `4px solid ${dept.color}` }}>
                    <div className="dept-color-badge" style={{ background: dept.color }} />
                    <h3>{dept.name}</h3>
                  </div>

                  <p className="dept-description">{dept.description}</p>

                  <div className="dept-card-info">
                    <div className="info-item">
                      <Users size={16} />
                      <span>{dept.member_count} сотрудник(ов)</span>
                    </div>
                    {head && (
                      <div className="info-item">
                        <span className="head-label">Руководитель:</span>
                        <span>{head.first_name} {head.last_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="dept-card-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => handleEdit(dept)}
                      title="Редактировать"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(dept.id)}
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="create-dept-overlay">
          <div className="create-dept-modal">
            <div className="create-modal-header">
              <h3>{editingDepartment ? 'Редактировать отдел' : 'Создать отдел'}</h3>
              <button onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="create-modal-body">
              <div className="form-group">
                <label>Название отдела *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="например, Engineering"
                />
              </div>

              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Краткое описание отдела..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Цвет отдела</label>
                <div className="color-picker">
                  {colorOptions.map((option) => (
                    <button
                      key={option.color}
                      className={`color-option ${formData.color === option.color ? 'selected' : ''}`}
                      style={{ background: option.color }}
                      onClick={() => setFormData({ ...formData, color: option.color })}
                      title={option.name}
                    >
                      {formData.color === option.color && (
                        <span className="checkmark">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Руководитель отдела</label>
                <select
                  value={formData.head_id}
                  onChange={(e) => setFormData({ ...formData, head_id: e.target.value })}
                >
                  <option value="">Выберите руководителя</option>
                  {mockWorkUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="create-modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                style={{ background: moduleColor }}
              >
                {editingDepartment ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .department-manager-overlay {
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

        .department-manager-modal {
          background: white;
          border-radius: 12px;
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
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

        .header-left h2 {
          margin: 0;
          font-size: 1.5rem;
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
          transition: color 0.2s ease;
        }

        .close-btn:hover {
          color: #050505;
        }

        .modal-actions {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #E4E6EB;
        }

        .create-dept-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .create-dept-btn:hover {
          opacity: 0.9;
        }

        .departments-grid {
          padding: 1.5rem;
          overflow-y: auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .empty-state {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 3rem 1rem;
          color: #65676B;
        }

        .empty-state p {
          margin-top: 1rem;
        }

        .department-card {
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .department-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .dept-card-header {
          padding: 1rem;
          position: relative;
        }

        .dept-color-badge {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          margin-bottom: 0.5rem;
        }

        .dept-card-header h3 {
          margin: 0;
          font-size: 1.125rem;
          color: #050505;
        }

        .dept-description {
          padding: 0 1rem 1rem;
          font-size: 0.875rem;
          color: #65676B;
          margin: 0;
          line-height: 1.4;
        }

        .dept-card-info {
          padding: 1rem;
          background: #F8F9FA;
          border-top: 1px solid #E4E6EB;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #65676B;
        }

        .head-label {
          font-weight: 600;
          color: #050505;
        }

        .dept-card-actions {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-top: 1px solid #E4E6EB;
        }

        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          border: 1px solid #E4E6EB;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn.edit:hover {
          background: #EFF6FF;
          border-color: #1D4ED8;
          color: #1D4ED8;
        }

        .action-btn.delete:hover {
          background: #FEE2E2;
          border-color: #DC2626;
          color: #DC2626;
        }

        .create-dept-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
        }

        .create-dept-modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .create-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #E4E6EB;
        }

        .create-modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
        }

        .create-modal-header button {
          background: none;
          border: none;
          cursor: pointer;
          color: #65676B;
        }

        .create-modal-body {
          padding: 1.5rem;
          overflow-y: auto;
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #050505;
          font-size: 0.875rem;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
          font-size: 0.875rem;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #1D4ED8;
        }

        .color-picker {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 0.5rem;
        }

        .color-option {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .color-option:hover {
          transform: scale(1.1);
        }

        .color-option.selected {
          border-color: #050505;
        }

        .checkmark {
          color: white;
          font-weight: bold;
          font-size: 1.25rem;
        }

        .create-modal-footer {
          display: flex;
          gap: 0.75rem;
          padding: 1.5rem;
          border-top: 1px solid #E4E6EB;
        }

        .btn-secondary,
        .btn-primary {
          flex: 1;
          padding: 0.75rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .btn-secondary {
          background: #F0F2F5;
          border: none;
          color: #050505;
        }

        .btn-primary {
          border: none;
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

export default WorkDepartmentManager;