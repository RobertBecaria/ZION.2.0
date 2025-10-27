import React, { useState, useEffect } from 'react';
import { X, Save, Briefcase, Users, LogOut, UserCog, AlertCircle } from 'lucide-react';
import WorkTeamManager from './WorkTeamManager';

const WorkMemberSettings = ({ organizationId, currentMembership, onClose, onUpdate }) => {
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
  const API = `${BACKEND_URL}/api`;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [jobTitle, setJobTitle] = useState(currentMembership?.job_title || '');
  const [requestedRole, setRequestedRole] = useState(currentMembership?.role || '');
  const [requestedDepartment, setRequestedDepartment] = useState(currentMembership?.department || '');
  const [requestedTeam, setRequestedTeam] = useState(currentMembership?.team || '');
  const [reason, setReason] = useState('');
  
  // Team creation
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  
  // Leave confirmation
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  const workRoles = [
    'OWNER', 'ADMIN', 'CEO', 'CTO', 'CFO', 'COO',
    'FOUNDER', 'CO_FOUNDER', 'PRESIDENT', 'VICE_PRESIDENT',
    'DIRECTOR', 'MANAGER', 'SENIOR_MANAGER', 'TEAM_LEAD',
    'EMPLOYEE', 'SENIOR_EMPLOYEE', 'MEMBER', 'CONTRACTOR',
    'INTERN', 'CONSULTANT', 'CLIENT', 'CUSTOM'
  ];
  
  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const token = localStorage.getItem('zion_token');
      const hasChanges = 
        jobTitle !== currentMembership?.job_title ||
        requestedRole !== currentMembership?.role ||
        requestedDepartment !== currentMembership?.department ||
        requestedTeam !== currentMembership?.team;
      
      if (!hasChanges) {
        setError('Нет изменений для сохранения');
        return;
      }
      
      const updateData = {};
      
      if (jobTitle !== currentMembership?.job_title) {
        updateData.job_title = jobTitle;
      }
      
      if (requestedRole !== currentMembership?.role) {
        updateData.requested_role = requestedRole;
        updateData.reason = reason;
      }
      
      if (requestedDepartment !== currentMembership?.department) {
        updateData.requested_department = requestedDepartment;
        updateData.reason = reason;
      }
      
      if (requestedTeam !== currentMembership?.team) {
        updateData.requested_team = requestedTeam;
        updateData.reason = reason;
      }
      
      const response = await fetch(
        `${API}/work/organizations/${organizationId}/members/me`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updateData)
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при обновлении настроек');
      }
      
      setSuccess(
        data.job_title_updated
          ? 'Должность обновлена! '
          : '' +
        data.change_requests_created.length > 0
          ? `Запросы на изменение отправлены (${data.change_requests_created.join(', ')})`
          : ''
      );
      
      if (onUpdate) {
        onUpdate();
      }
      
      // Clear reason after submission
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateTeam = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!teamName.trim()) {
        setError('Введите название команды');
        return;
      }
      
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${API}/work/organizations/${organizationId}/teams`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: teamName,
            description: teamDescription
          })
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при создании команды');
      }
      
      setSuccess('Команда успешно создана!');
      setShowTeamForm(false);
      setTeamName('');
      setTeamDescription('');
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLeaveOrganization = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${API}/work/organizations/${organizationId}/leave`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при выходе из организации');
      }
      
      setSuccess('Вы покинули организацию');
      setTimeout(() => {
        if (onClose) {
          onClose();
        }
        window.location.reload(); // Refresh to update organization list
      }, 1500);
    } catch (err) {
      setError(err.message);
      setShowLeaveConfirm(false);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="work-member-settings">
      <div className="settings-header">
        <h3><UserCog size={20} /> МОИ НАСТРОЙКИ</h3>
      </div>
      
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
      {success && (
        <div className="success-banner">
          {success}
        </div>
      )}
      
      <div className="settings-content">
        {/* Current Info */}
        <div className="settings-section">
          <h4>Текущая информация</h4>
          <div className="current-info">
            <p><strong>Роль:</strong> {currentMembership?.role}</p>
            <p><strong>Должность:</strong> {currentMembership?.job_title || 'Не указана'}</p>
            <p><strong>Отдел:</strong> {currentMembership?.department || 'Не указан'}</p>
            <p><strong>Команда:</strong> {currentMembership?.team || 'Не указана'}</p>
          </div>
        </div>
        
        {/* Job Title (Direct Update) */}
        <div className="settings-section">
          <h4><Briefcase size={18} /> Должность (обновляется сразу)</h4>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Например: Senior Developer"
            className="settings-input"
          />
        </div>
        
        {/* Role Change Request */}
        <div className="settings-section">
          <h4>Запросить изменение роли</h4>
          <select
            value={requestedRole}
            onChange={(e) => setRequestedRole(e.target.value)}
            className="settings-select"
          >
            {workRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <p className="help-text">Требует одобрения администратора</p>
        </div>
        
        {/* Department Change Request */}
        <div className="settings-section">
          <h4>Запросить изменение отдела</h4>
          <input
            type="text"
            value={requestedDepartment}
            onChange={(e) => setRequestedDepartment(e.target.value)}
            placeholder="Например: Engineering"
            className="settings-input"
          />
          <p className="help-text">Требует одобрения администратора</p>
        </div>
        
        {/* Team Change Request */}
        <div className="settings-section">
          <h4>Запросить изменение команды</h4>
          <input
            type="text"
            value={requestedTeam}
            onChange={(e) => setRequestedTeam(e.target.value)}
            placeholder="Например: Backend Team"
            className="settings-input"
          />
          <p className="help-text">Требует одобрения администратора</p>
        </div>
        
        {/* Reason for Changes */}
        {(requestedRole !== currentMembership?.role || 
          requestedDepartment !== currentMembership?.department || 
          requestedTeam !== currentMembership?.team) && (
          <div className="settings-section">
            <h4>Причина запроса</h4>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Объясните, почему вам нужны эти изменения..."
              className="settings-textarea"
              rows={3}
            />
          </div>
        )}
        
        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="btn-primary"
        >
          <Save size={18} />
          {loading ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
        
        {/* Team Management */}
        <div className="settings-section" style={{ marginTop: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
          <h4><Users size={18} /> Команды</h4>
          {!showTeamForm && (
            <button
              onClick={() => setShowTeamForm(true)}
              className="btn-secondary"
            >
              <Users size={18} />
              Создать команду
            </button>
          )}
          
          {showTeamForm && (
            <div className="team-form">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Название команды"
                className="settings-input"
                style={{ marginBottom: '0.75rem' }}
              />
              <textarea
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                placeholder="Описание команды (опционально)"
                className="settings-textarea"
                rows={2}
                style={{ marginBottom: '0.75rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleCreateTeam}
                  disabled={loading}
                  className="btn-primary"
                >
                  Создать
                </button>
                <button
                  onClick={() => {
                    setShowTeamForm(false);
                    setTeamName('');
                    setTeamDescription('');
                  }}
                  className="btn-secondary"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Leave Organization */}
        <div className="settings-section danger-zone" style={{ marginTop: '2rem', borderTop: '2px solid #fee2e2', paddingTop: '1.5rem' }}>
          <h4 style={{ color: '#dc2626' }}><LogOut size={18} /> Опасная зона</h4>
          {!showLeaveConfirm && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="btn-danger"
            >
              <LogOut size={18} />
              Покинуть компанию
            </button>
          )}
          
          {showLeaveConfirm && (
            <div className="leave-confirm">
              <p style={{ color: '#dc2626', fontWeight: '500', marginBottom: '1rem' }}>
                Вы уверены, что хотите покинуть эту организацию?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleLeaveOrganization}
                  disabled={loading}
                  className="btn-danger"
                >
                  Да, покинуть
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="btn-secondary"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkMemberSettings;
