import React, { useState, useEffect } from 'react';
import { Building2, Users, UserPlus, Search, Filter, LayoutGrid, List, ChevronLeft, Edit3, Trash2, MoreHorizontal, TrendingUp, Activity, Clock, Plus, X, UserMinus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;

function WorkDepartmentManagementPage({ organizationId, onBack, moduleColor = '#C2410C' }) {
  const [departments, setDepartments] = useState([]);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [departmentMembers, setDepartmentMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: '#1D4ED8',
    head_id: ''
  });
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    fetchDepartments();
    fetchOrganizationMembers();
  }, [organizationId]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/departments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizationMembers = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizationMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching organization members:', error);
    }
  };

  const fetchDepartmentMembers = async (departmentId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/organizations/${organizationId}/departments/${departmentId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const members = data.data || [];
        setDepartmentMembers(members);
        
        // Calculate available members (org members not in this department)
        const memberUserIds = members.map(m => m.user_id);
        const available = organizationMembers.filter(om => !memberUserIds.includes(om.user_id));
        setAvailableMembers(available);
      }
    } catch (error) {
      console.error('Error fetching department members:', error);
    }
  };

  const handleViewMembers = async (dept) => {
    setSelectedDepartment(dept);
    await fetchDepartmentMembers(dept.id);
    setShowMemberModal(true);
  };

  const handleAddMember = async (userId) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/departments/${selectedDepartment.id}/members`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId })
        }
      );

      if (response.ok) {
        await fetchDepartmentMembers(selectedDepartment.id);
        await fetchDepartments(); // Refresh to update member counts
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при добавлении члена');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Произошла ошибка');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Удалить этого сотрудника из отдела?')) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/departments/${selectedDepartment.id}/members/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        await fetchDepartmentMembers(selectedDepartment.id);
        await fetchDepartments();
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при удалении члена');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Произошла ошибка');
    }
  };

  const handleEditDepartment = (dept) => {
    setSelectedDepartment(dept);
    setEditFormData({
      name: dept.name,
      description: dept.description || '',
      color: dept.color,
      head_id: dept.head_id || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editFormData.name.trim()) {
      alert('Введите название отдела');
      return;
    }

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/departments/${selectedDepartment.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editFormData)
        }
      );

      if (response.ok) {
        alert('Отдел обновлен!');
        setShowEditModal(false);
        await fetchDepartments();
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при обновлении отдела');
      }
    } catch (error) {
      console.error('Error updating department:', error);
      alert('Произошла ошибка');
    }
  };

  const handleDeleteDepartment = async (deptId, deptName) => {
    if (!window.confirm(`Удалить отдел "${deptName}"? Это действие нельзя отменить.`)) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/organizations/${organizationId}/departments/${deptId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        alert('Отдел удален!');
        await fetchDepartments();
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при удалении отдела');
      }
    } catch (error) {
      console.error('Error deleting department:', error);
      alert('Произошла ошибка');
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      alert('Введите email адрес');
      return;
    }

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${organizationId}/invite`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email: inviteEmail })
        }
      );

      if (response.ok) {
        alert('Приглашение отправлено!');
        setInviteEmail('');
        setShowInviteModal(false);
        // Refresh members list
        await fetchOrganizationMembers();
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при отправке приглашения');
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      alert('Произошла ошибка');
    }
  };

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

  const filteredDepartments = departments.filter(dept => 
    dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dept.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTotalMembers = () => {
    return departments.reduce((sum, dept) => sum + (dept.member_count || 0), 0);
  };

  if (loading) {
    return (
      <div className="dept-management-page">
        <div className="loading-state">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="dept-management-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={20} />
          Назад
        </button>
        <div className="header-title">
          <Building2 size={28} style={{ color: moduleColor }} />
          <div>
            <h1>Управление отделами</h1>
            <p>{departments.length} отдел(ов) • {getTotalMembers()} сотрудников</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: `${moduleColor}15`, color: moduleColor }}>
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Всего отделов</span>
            <span className="stat-value">{departments.length}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: `${moduleColor}15`, color: moduleColor }}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Всего сотрудников</span>
            <span className="stat-value">{getTotalMembers()}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: `${moduleColor}15`, color: moduleColor }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Средний размер</span>
            <span className="stat-value">
              {departments.length > 0 ? Math.round(getTotalMembers() / departments.length) : 0}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: `${moduleColor}15`, color: moduleColor }}>
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Активных</span>
            <span className="stat-value">{departments.length}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Поиск отделов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <button
            className="invite-btn"
            onClick={() => setShowInviteModal(true)}
            style={{ background: `${moduleColor}15`, color: moduleColor }}
          >
            <UserPlus size={18} />
            Пригласить в организацию
          </button>
          <div className="view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              style={{ color: viewMode === 'grid' ? moduleColor : '#65676B' }}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              style={{ color: viewMode === 'list' ? moduleColor : '#65676B' }}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Departments Display */}
      {filteredDepartments.length === 0 ? (
        <div className="empty-state-large">
          <Building2 size={64} style={{ color: '#BCC0C4' }} />
          <h3>Нет отделов</h3>
          <p>Создайте первый отдел для организации работы</p>
        </div>
      ) : (
        <div className={`departments-display ${viewMode}`}>
          {filteredDepartments.map((dept) => {
            const head = organizationMembers.find(m => m.user_id === dept.head_id);
            
            return (
              <div key={dept.id} className="dept-card-enhanced">
                <div className="dept-card-header" style={{ borderLeft: `4px solid ${dept.color}` }}>
                  <div className="dept-color-indicator" style={{ background: dept.color }} />
                  <div className="dept-header-content">
                    <h3>{dept.name}</h3>
                    {dept.description && <p className="dept-desc">{dept.description}</p>}
                  </div>
                </div>

                <div className="dept-card-body">
                  <div className="dept-info-row">
                    <div className="info-block">
                      <span className="info-label">Сотрудников</span>
                      <span className="info-value">{dept.member_count || 0}</span>
                    </div>
                    <div className="info-block">
                      <span className="info-label">Руководитель</span>
                      <span className="info-value">
                        {head ? `${head.first_name} ${head.last_name}` : 'Не назначен'}
                      </span>
                    </div>
                  </div>

                  <div className="dept-actions-row">
                    <button
                      className="dept-action-btn primary"
                      onClick={() => handleViewMembers(dept)}
                      style={{ background: `${moduleColor}15`, color: moduleColor }}
                    >
                      <Users size={16} />
                      Управление членами
                    </button>
                    <button
                      className="dept-action-btn secondary"
                      onClick={() => handleEditDepartment(dept)}
                      style={{ background: '#F0F2F5', color: '#050505' }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="dept-action-btn danger"
                      onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                      style={{ background: '#FEE2E2', color: '#DC2626' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Member Management Modal */}
      {showMemberModal && selectedDepartment && (
        <div className="member-modal-overlay">
          <div className="member-modal">
            <div className="member-modal-header">
              <div>
                <h3>Сотрудники отдела: {selectedDepartment.name}</h3>
                <p>{departmentMembers.length} сотрудник(ов)</p>
              </div>
              <button onClick={() => setShowMemberModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="member-modal-body">
              {/* Current Members */}
              <div className="members-section">
                <h4>Текущие сотрудники</h4>
                {departmentMembers.length === 0 ? (
                  <div className="empty-members">
                    <Users size={32} style={{ color: '#BCC0C4' }} />
                    <p>В отделе пока нет сотрудников</p>
                  </div>
                ) : (
                  <div className="members-list">
                    {departmentMembers.map((member) => {
                      const orgMember = organizationMembers.find(om => om.user_id === member.user_id);
                      return (
                        <div key={member.user_id} className="member-item">
                          <div className="member-info">
                            <div className="member-avatar">
                              {orgMember?.first_name?.[0]}{orgMember?.last_name?.[0]}
                            </div>
                            <div className="member-details">
                              <span className="member-name">
                                {orgMember?.first_name} {orgMember?.last_name}
                              </span>
                              <span className="member-role">{orgMember?.work_role || 'Сотрудник'}</span>
                            </div>
                          </div>
                          <button
                            className="remove-member-btn"
                            onClick={() => handleRemoveMember(member.user_id)}
                            title="Удалить из отдела"
                          >
                            <UserMinus size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Available Members to Add */}
              {availableMembers.length > 0 && (
                <div className="members-section">
                  <h4>Добавить сотрудников ({availableMembers.length})</h4>
                  <div className="members-list">
                    {availableMembers.map((member) => (
                      <div key={member.user_id} className="member-item">
                        <div className="member-info">
                          <div className="member-avatar">
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </div>
                          <div className="member-details">
                            <span className="member-name">
                              {member.first_name} {member.last_name}
                            </span>
                            <span className="member-role">{member.work_role || 'Сотрудник'}</span>
                          </div>
                        </div>
                        <button
                          className="add-member-btn"
                          onClick={() => handleAddMember(member.user_id)}
                          style={{ background: `${moduleColor}15`, color: moduleColor }}
                          title="Добавить в отдел"
                        >
                          <UserPlus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditModal && selectedDepartment && (
        <div className="member-modal-overlay">
          <div className="member-modal">
            <div className="member-modal-header">
              <div>
                <h3>Редактировать отдел</h3>
                <p>{selectedDepartment.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="member-modal-body">
              <div className="form-group">
                <label>Название отдела *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  placeholder="Введите название"
                />
              </div>

              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  placeholder="Введите описание"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Цвет</label>
                <div className="color-options">
                  {colorOptions.map((option) => (
                    <button
                      key={option.color}
                      className={`color-option ${editFormData.color === option.color ? 'selected' : ''}`}
                      style={{ background: option.color }}
                      onClick={() => setEditFormData({...editFormData, color: option.color})}
                      title={option.name}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Руководитель</label>
                <select
                  value={editFormData.head_id}
                  onChange={(e) => setEditFormData({...editFormData, head_id: e.target.value})}
                >
                  <option value="">Не назначен</option>
                  {organizationMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.first_name} {member.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions-row">
                <button
                  className="cancel-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  Отмена
                </button>
                <button
                  className="save-btn"
                  onClick={handleSaveEdit}
                  style={{ background: moduleColor }}
                >
                  Сохранить изменения
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="member-modal-overlay">
          <div className="member-modal invite-modal">
            <div className="member-modal-header">
              <div>
                <h3>Пригласить в организацию</h3>
                <p>Отправить приглашение по email</p>
              </div>
              <button onClick={() => setShowInviteModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="member-modal-body">
              <div className="form-group">
                <label>Email адрес *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="example@email.com"
                />
              </div>

              <div className="invite-info">
                <div className="info-icon" style={{ background: `${moduleColor}15`, color: moduleColor }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h4>Как это работает?</h4>
                  <p>Пользователь получит приглашение по email и сможет присоединиться к организации после регистрации.</p>
                </div>
              </div>

              <div className="modal-actions-row">
                <button
                  className="cancel-btn"
                  onClick={() => setShowInviteModal(false)}
                >
                  Отмена
                </button>
                <button
                  className="save-btn"
                  onClick={handleInviteMember}
                  style={{ background: moduleColor }}
                >
                  <UserPlus size={18} />
                  Отправить приглашение
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dept-management-page {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
          color: #050505;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-btn:hover {
          background: #F0F2F5;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-title h1 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 600;
          color: #050505;
        }

        .header-title p {
          margin: 0.25rem 0 0 0;
          font-size: 0.875rem;
          color: #65676B;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .stat-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }

        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 12px;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #65676B;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #050505;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
          max-width: 400px;
          padding: 0.75rem 1rem;
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
        }

        .search-box input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 0.9375rem;
          color: #050505;
        }

        .search-box input::placeholder {
          color: #BCC0C4;
        }

        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .invite-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border: none;
          border-radius: 8px;
          font-size: 0.9375rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .invite-btn:hover {
          opacity: 0.8;
          transform: translateY(-1px);
        }

        .view-toggle {
          display: flex;
          gap: 0.5rem;
          padding: 0.25rem;
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
        }

        .view-toggle button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .view-toggle button.active {
          background: #F0F2F5;
        }

        .departments-display {
          display: grid;
          gap: 1.5rem;
        }

        .departments-display.grid {
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        }

        .departments-display.list {
          grid-template-columns: 1fr;
        }

        .dept-card-enhanced {
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .dept-card-enhanced:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        .dept-card-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.5rem;
          background: #F9FAFB;
        }

        .dept-color-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 0.25rem;
        }

        .dept-header-content h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #050505;
        }

        .dept-desc {
          margin: 0.5rem 0 0 0;
          font-size: 0.875rem;
          color: #65676B;
          line-height: 1.5;
        }

        .dept-card-body {
          padding: 1.5rem;
        }

        .dept-info-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .info-block {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .info-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #65676B;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 1rem;
          font-weight: 600;
          color: #050505;
        }

        .dept-actions-row {
          display: flex;
          gap: 0.75rem;
        }

        .dept-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          flex: 1;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .dept-action-btn:hover {
          opacity: 0.8;
          transform: translateY(-1px);
        }

        .empty-state-large {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          text-align: center;
          background: white;
          border: 1px solid #E4E6EB;
          border-radius: 12px;
        }

        .empty-state-large h3 {
          margin: 1rem 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #050505;
        }

        .empty-state-large p {
          margin: 0;
          font-size: 0.9375rem;
          color: #65676B;
        }

        .member-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 2rem;
        }

        .member-modal {
          width: 100%;
          max-width: 700px;
          max-height: 80vh;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .member-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #E4E6EB;
        }

        .member-modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #050505;
        }

        .member-modal-header p {
          margin: 0.25rem 0 0 0;
          font-size: 0.875rem;
          color: #65676B;
        }

        .member-modal-header button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .member-modal-header button:hover {
          background: #F0F2F5;
        }

        .member-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 2rem;
        }

        .members-section {
          margin-bottom: 2rem;
        }

        .members-section:last-child {
          margin-bottom: 0;
        }

        .members-section h4 {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: #65676B;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .members-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .member-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: #F9FAFB;
          border: 1px solid #E4E6EB;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .member-item:hover {
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .member-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }

        .member-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        .member-details {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .member-name {
          font-size: 0.9375rem;
          font-weight: 500;
          color: #050505;
        }

        .member-role {
          font-size: 0.8125rem;
          color: #65676B;
        }

        .remove-member-btn,
        .add-member-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .remove-member-btn {
          background: #FEE2E2;
          color: #DC2626;
        }

        .remove-member-btn:hover {
          background: #FCA5A5;
        }

        .add-member-btn:hover {
          opacity: 0.8;
        }

        .empty-members {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
          text-align: center;
          background: #F9FAFB;
          border: 1px dashed #E4E6EB;
          border-radius: 8px;
        }

        .empty-members p {
          margin: 1rem 0 0 0;
          font-size: 0.875rem;
          color: #65676B;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          font-size: 1rem;
          color: #65676B;
        }

        @media (max-width: 768px) {
          .dept-management-page {
            padding: 1rem;
          }

          .page-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .search-box {
            max-width: none;
          }

          .departments-display.grid {
            grid-template-columns: 1fr;
          }

          .dept-info-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default WorkDepartmentManagementPage;