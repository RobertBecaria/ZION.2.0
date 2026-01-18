import React, { useState, useEffect } from 'react';
import { Users, Plus, X, Briefcase, User, Calendar, AlertCircle, Check, Trash2, Edit } from 'lucide-react';

import { BACKEND_URL } from '../config/api';
const WorkTeamManager = ({ organizationId, currentMembership, onClose }) => {
    const API = `${BACKEND_URL}/api`;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: '',
    team_lead_id: ''
  });
  
  useEffect(() => {
    loadTeams();
    loadDepartments();
    loadOrganizationMembers();
  }, [organizationId]);
  
  const loadTeams = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${API}/work/organizations/${organizationId}/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTeams(data.data || []);
      } else {
        setError(data.detail || 'Ошибка при загрузке команд');
      }
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };
  
  const loadDepartments = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${API}/organizations/${organizationId}/departments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };
  
  const loadOrganizationMembers = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${API}/work/organizations/${organizationId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setOrganizationMembers(data.members || []);
      }
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };
  
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Название команды обязательно');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${API}/work/organizations/${organizationId}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          department_id: formData.department_id || null,
          team_lead_id: formData.team_lead_id || null
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess('Команда успешно создана!');
        setShowCreateForm(false);
        setFormData({ name: '', description: '', department_id: '', team_lead_id: '' });
        loadTeams();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.detail || 'Ошибка при создании команды');
      }
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };
  
  const getTeamLeadName = (teamLeadId) => {
    const member = organizationMembers.find(m => m.user_id === teamLeadId);
    if (member) {
      return `${member.first_name} ${member.last_name}`;
    }
    return 'Не указан';
  };
  
  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : 'Общий';
  };
  
  return (
    <div className="work-team-manager">
      {/* Header */}
      <div className="team-manager-header">
        <div className="header-left">
          <Users size={24} className="text-orange-600" />
          <h2>Команды</h2>
        </div>
        
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary"
            disabled={loading}
          >
            <Plus size={18} />
            Создать команду
          </button>
        )}
      </div>
      
      {/* Success Message */}
      {success && (
        <div className="success-banner">
          <Check size={18} />
          {success}
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      
      {/* Create Team Form */}
      {showCreateForm && (
        <div className="team-create-form">
          <div className="form-header">
            <h3>Создать новую команду</h3>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setFormData({ name: '', description: '', department_id: '', team_lead_id: '' });
                setError('');
              }}
              className="btn-icon"
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleCreateTeam}>
            <div className="form-group">
              <label>Название команды *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Backend Team"
                className="settings-input"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Описание</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Опишите цели и задачи команды"
                rows={3}
                className="settings-textarea"
              />
            </div>
            
            <div className="form-group">
              <label>Отдел</label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="settings-select"
              >
                <option value="">Не привязан к отделу</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Руководитель команды</label>
              <select
                value={formData.team_lead_id}
                onChange={(e) => setFormData({ ...formData, team_lead_id: e.target.value })}
                className="settings-select"
              >
                <option value="">Я буду руководителем</option>
                {organizationMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.first_name} {member.last_name} ({member.role})
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Если не выбран, вы автоматически станете руководителем команды
              </small>
            </div>
            
            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Создание...' : 'Создать команду'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({ name: '', description: '', department_id: '', team_lead_id: '' });
                  setError('');
                }}
                className="btn-secondary"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Teams List */}
      <div className="teams-list">
        {loading && teams.length === 0 && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Загрузка команд...</p>
          </div>
        )}
        
        {!loading && teams.length === 0 && (
          <div className="empty-state">
            <Users size={48} style={{ opacity: 0.3 }} />
            <p>Команды еще не созданы</p>
            <small>Создайте первую команду, чтобы организовать работу</small>
          </div>
        )}
        
        {teams.length > 0 && (
          <div className="teams-grid">
            {teams.map((team) => (
              <div key={team.id} className="team-card">
                <div className="team-card-header">
                  <div className="team-icon">
                    <Users size={24} />
                  </div>
                  <div className="team-info">
                    <h4>{team.name}</h4>
                    {team.department_id && (
                      <span className="department-badge">
                        <Briefcase size={14} />
                        {getDepartmentName(team.department_id)}
                      </span>
                    )}
                  </div>
                </div>
                
                {team.description && (
                  <p className="team-description">{team.description}</p>
                )}
                
                <div className="team-meta">
                  <div className="meta-item">
                    <User size={16} />
                    <span>Руководитель: {getTeamLeadName(team.team_lead_id)}</span>
                  </div>
                  <div className="meta-item">
                    <Users size={16} />
                    <span>Участников: {team.member_ids?.length || 0}</span>
                  </div>
                  <div className="meta-item">
                    <Calendar size={16} />
                    <span>Создана: {formatDate(team.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkTeamManager;
