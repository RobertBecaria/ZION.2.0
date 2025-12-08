/**
 * WorkTaskCreateModal Component
 * Modal for creating new tasks with subtasks and templates
 */
import React, { useState, useEffect } from 'react';
import {
  X, Plus, Trash2, Calendar, Clock, User, Users, Building,
  AlertCircle, Image, Save, FileText
} from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Низкий', color: '#22c55e' },
  { value: 'MEDIUM', label: 'Средний', color: '#eab308' },
  { value: 'HIGH', label: 'Высокий', color: '#ea580c' },
  { value: 'URGENT', label: 'Срочно', color: '#dc2626' }
];

const ASSIGNMENT_OPTIONS = [
  { value: 'PERSONAL', label: 'Личная задача', icon: User },
  { value: 'USER', label: 'Назначить сотруднику', icon: User },
  { value: 'TEAM', label: 'Для команды', icon: Users },
  { value: 'DEPARTMENT', label: 'Для отдела', icon: Building }
];

const WorkTaskCreateModal = ({
  organizationId,
  currentUser,
  moduleColor = '#C2410C',
  onClose,
  onTaskCreated,
  initialTemplate = null
}) => {
  const [formData, setFormData] = useState({
    title: initialTemplate?.title || '',
    description: initialTemplate?.description || '',
    assignment_type: initialTemplate?.default_assignment_type || 'PERSONAL',
    assigned_to: '',
    team_id: '',
    department_id: '',
    priority: initialTemplate?.priority || 'MEDIUM',
    deadline: '',
    deadline_time: '',
    subtasks: initialTemplate?.subtasks || [],
    requires_photo_proof: initialTemplate?.requires_photo_proof || false,
    save_as_template: false,
    template_name: '',
    template_id: initialTemplate?.id || ''
  });

  const [newSubtask, setNewSubtask] = useState('');
  const [templates, setTemplates] = useState([]);
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch templates, members, teams, departments
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('zion_token');
      
      try {
        // Fetch templates
        const templatesRes = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/task-templates`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.templates || []);
        }

        // Fetch members
        const membersRes = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/members`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members || []);
        }

        // Fetch teams
        const teamsRes = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/teams`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (teamsRes.ok) {
          const data = await teamsRes.json();
          setTeams(data.teams || []);
        }

        // Fetch departments
        const deptRes = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/departments`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (deptRes.ok) {
          const data = await deptRes.json();
          setDepartments(data.departments || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, [organizationId]);

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title,
        description: template.description || '',
        priority: template.priority,
        subtasks: template.subtasks || [],
        requires_photo_proof: template.requires_photo_proof,
        assignment_type: template.default_assignment_type,
        template_id: templateId
      }));
    }
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setFormData(prev => ({
        ...prev,
        subtasks: [...prev.subtasks, newSubtask.trim()]
      }));
      setNewSubtask('');
    }
  };

  const removeSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Введите название задачи');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('zion_token');
      
      // Build deadline
      let deadline = null;
      if (formData.deadline) {
        deadline = formData.deadline;
        if (formData.deadline_time) {
          deadline += `T${formData.deadline_time}:00`;
        } else {
          deadline += 'T23:59:00';
        }
      }

      const requestBody = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        assignment_type: formData.assignment_type,
        assigned_to: formData.assignment_type === 'USER' ? formData.assigned_to : null,
        team_id: formData.assignment_type === 'TEAM' ? formData.team_id : null,
        department_id: formData.assignment_type === 'DEPARTMENT' ? formData.department_id : null,
        priority: formData.priority,
        deadline: deadline,
        subtasks: formData.subtasks,
        requires_photo_proof: formData.requires_photo_proof,
        template_id: formData.template_id || null,
        save_as_template: formData.save_as_template,
        template_name: formData.save_as_template ? formData.template_name : null
      };

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/tasks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (response.ok) {
        const data = await response.json();
        onTaskCreated && onTaskCreated(data.task);
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Ошибка создания задачи');
      }
    } catch (err) {
      setError('Ошибка сети');
      console.error('Error creating task:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="task-create-modal" 
        onClick={e => e.stopPropagation()}
        style={{ '--module-color': moduleColor }}
      >
        {/* Header */}
        <div className="modal-header">
          <h2>Новая задача</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="form-group">
              <label><FileText size={14} /> Из шаблона</label>
              <select
                value={formData.template_id}
                onChange={(e) => handleTemplateSelect(e.target.value)}
              >
                <option value="">Выберите шаблон...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label>Название задачи *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Что нужно сделать?"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Подробности задачи..."
              rows={3}
            />
          </div>

          {/* Assignment Type */}
          <div className="form-group">
            <label>Назначение</label>
            <div className="assignment-options">
              {ASSIGNMENT_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`assignment-btn ${formData.assignment_type === opt.value ? 'active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, assignment_type: opt.value }))}
                    style={formData.assignment_type === opt.value ? { 
                      borderColor: moduleColor,
                      backgroundColor: `${moduleColor}10`
                    } : {}}
                  >
                    <Icon size={16} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee Selection */}
          {formData.assignment_type === 'USER' && (
            <div className="form-group">
              <label>Сотрудник</label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
              >
                <option value="">Выберите сотрудника...</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.assignment_type === 'TEAM' && (
            <div className="form-group">
              <label>Команда</label>
              <select
                value={formData.team_id}
                onChange={(e) => setFormData(prev => ({ ...prev, team_id: e.target.value }))}
              >
                <option value="">Выберите команду...</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.assignment_type === 'DEPARTMENT' && (
            <div className="form-group">
              <label>Отдел</label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
              >
                <option value="">Выберите отдел...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Priority & Deadline Row */}
          <div className="form-row">
            <div className="form-group">
              <label><AlertCircle size={14} /> Приоритет</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label><Calendar size={14} /> Дедлайн</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label><Clock size={14} /> Время</label>
              <input
                type="time"
                value={formData.deadline_time}
                onChange={(e) => setFormData(prev => ({ ...prev, deadline_time: e.target.value }))}
              />
            </div>
          </div>

          {/* Subtasks */}
          <div className="form-group">
            <label>Подзадачи</label>
            <div className="subtasks-input">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Добавить подзадачу..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
              />
              <button type="button" onClick={addSubtask} style={{ color: moduleColor }}>
                <Plus size={18} />
              </button>
            </div>
            {formData.subtasks.length > 0 && (
              <ul className="subtasks-list">
                {formData.subtasks.map((subtask, index) => (
                  <li key={index}>
                    <span>{subtask}</span>
                    <button type="button" onClick={() => removeSubtask(index)}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Photo Proof */}
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.requires_photo_proof}
                onChange={(e) => setFormData(prev => ({ ...prev, requires_photo_proof: e.target.checked }))}
              />
              <Image size={14} />
              <span>Требовать фото при завершении</span>
            </label>
          </div>

          {/* Save as Template */}
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.save_as_template}
                onChange={(e) => setFormData(prev => ({ ...prev, save_as_template: e.target.checked }))}
              />
              <Save size={14} />
              <span>Сохранить как шаблон</span>
            </label>
          </div>

          {formData.save_as_template && (
            <div className="form-group">
              <label>Название шаблона</label>
              <input
                type="text"
                value={formData.template_name}
                onChange={(e) => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
                placeholder="Название для шаблона..."
              />
            </div>
          )}

          {/* Error */}
          {error && <div className="form-error">{error}</div>}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
              style={{ backgroundColor: moduleColor }}
            >
              {loading ? 'Создание...' : 'Создать задачу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkTaskCreateModal;
