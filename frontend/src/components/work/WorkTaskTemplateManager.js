/**
 * WorkTaskTemplateManager Component
 * Modal for managing task templates - view, edit, delete
 */
import React, { useState, useEffect } from 'react';
import {
  X, Plus, Trash2, Edit2, FileText, AlertCircle, CheckCircle2,
  Image, User, Users, Building, Clock, Save, ChevronDown, ChevronUp
} from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Низкий', color: '#22c55e' },
  { value: 'MEDIUM', label: 'Средний', color: '#eab308' },
  { value: 'HIGH', label: 'Высокий', color: '#ea580c' },
  { value: 'URGENT', label: 'Срочно', color: '#dc2626' }
];

const ASSIGNMENT_OPTIONS = [
  { value: 'PERSONAL', label: 'Личная', icon: User },
  { value: 'USER', label: 'Сотрудник', icon: User },
  { value: 'TEAM', label: 'Команда', icon: Users },
  { value: 'DEPARTMENT', label: 'Отдел', icon: Building }
];

const WorkTaskTemplateManager = ({
  organizationId,
  moduleColor = '#C2410C',
  onClose,
  onTemplateSelect
}) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    subtasks: [],
    requires_photo_proof: false,
    default_assignment_type: 'PERSONAL'
  });
  const [newSubtask, setNewSubtask] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/task-templates`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        setError('Не удалось загрузить шаблоны');
      }
    } catch (err) {
      setError('Ошибка сети');
      console.error('Load templates error:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      description: '',
      priority: 'MEDIUM',
      subtasks: [],
      requires_photo_proof: false,
      default_assignment_type: 'PERSONAL'
    });
    setNewSubtask('');
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      title: template.title,
      description: template.description || '',
      priority: template.priority,
      subtasks: template.subtasks || [],
      requires_photo_proof: template.requires_photo_proof,
      default_assignment_type: template.default_assignment_type
    });
    setShowCreateForm(true);
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    resetForm();
    setShowCreateForm(true);
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

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.title.trim()) {
      setError('Заполните название шаблона и задачи');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const isEditing = editingTemplate !== null;
      
      const url = isEditing
        ? `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/task-templates/${editingTemplate.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/task-templates`;

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadTemplates();
        setShowCreateForm(false);
        resetForm();
        setEditingTemplate(null);
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Ошибка сохранения шаблона');
      }
    } catch (err) {
      setError('Ошибка сети');
      console.error('Save template error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Удалить этот шаблон?')) return;

    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/task-templates/${templateId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Ошибка удаления');
      }
    } catch (err) {
      setError('Ошибка сети');
    }
  };

  const handleUseTemplate = (template) => {
    onTemplateSelect && onTemplateSelect(template);
    onClose();
  };

  const getPriorityInfo = (priority) => {
    return PRIORITY_OPTIONS.find(p => p.value === priority) || PRIORITY_OPTIONS[1];
  };

  const getAssignmentInfo = (type) => {
    return ASSIGNMENT_OPTIONS.find(a => a.value === type) || ASSIGNMENT_OPTIONS[0];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="template-manager-modal"
        onClick={e => e.stopPropagation()}
        style={{ '--module-color': moduleColor }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="header-title">
            <FileText size={20} color={moduleColor} />
            <h2>Шаблоны задач</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="template-error">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Content */}
        <div className="template-manager-content">
          {showCreateForm ? (
            /* Create/Edit Form */
            <form onSubmit={handleSaveTemplate} className="template-form">
              <h3>{editingTemplate ? 'Редактировать шаблон' : 'Новый шаблон'}</h3>

              <div className="form-group">
                <label>Название шаблона *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Например: Ежемесячный отчёт"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Название задачи *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Заголовок задачи"
                />
              </div>

              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Детальное описание задачи..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Приоритет</label>
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
                  <label>Тип назначения</label>
                  <select
                    value={formData.default_assignment_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, default_assignment_type: e.target.value }))}
                  >
                    {ASSIGNMENT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
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

              {/* Form Actions */}
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingTemplate(null);
                    resetForm();
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="save-btn"
                  disabled={saving}
                  style={{ backgroundColor: moduleColor }}
                >
                  {saving ? 'Сохранение...' : (
                    <>
                      <Save size={16} />
                      {editingTemplate ? 'Сохранить' : 'Создать'}
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Templates List */
            <>
              <div className="template-list-header">
                <span>{templates.length} шаблон(ов)</span>
                <button
                  className="create-template-btn"
                  onClick={handleCreateNew}
                  style={{ backgroundColor: moduleColor }}
                >
                  <Plus size={16} />
                  Создать шаблон
                </button>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner" style={{ borderColor: `${moduleColor}40`, borderTopColor: moduleColor }}></div>
                  <span>Загрузка шаблонов...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="empty-state">
                  <FileText size={48} color="#d1d5db" />
                  <p>Нет сохранённых шаблонов</p>
                  <span>Создайте шаблон для быстрого создания задач</span>
                </div>
              ) : (
                <div className="templates-list">
                  {templates.map(template => {
                    const priorityInfo = getPriorityInfo(template.priority);
                    const assignmentInfo = getAssignmentInfo(template.default_assignment_type);
                    const AssignIcon = assignmentInfo.icon;
                    const isExpanded = expandedTemplate === template.id;

                    return (
                      <div key={template.id} className="template-card">
                        <div 
                          className="template-card-header"
                          onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                        >
                          <div className="template-info">
                            <h4>{template.name}</h4>
                            <p className="template-title">{template.title}</p>
                          </div>
                          <div className="template-meta">
                            <span 
                              className="priority-badge"
                              style={{ backgroundColor: `${priorityInfo.color}15`, color: priorityInfo.color }}
                            >
                              {priorityInfo.label}
                            </span>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="template-details">
                            {template.description && (
                              <p className="template-description">{template.description}</p>
                            )}

                            <div className="template-attributes">
                              <div className="attribute">
                                <AssignIcon size={14} />
                                <span>{assignmentInfo.label}</span>
                              </div>
                              {template.requires_photo_proof && (
                                <div className="attribute">
                                  <Image size={14} />
                                  <span>Фото обязательно</span>
                                </div>
                              )}
                              {template.subtasks?.length > 0 && (
                                <div className="attribute">
                                  <CheckCircle2 size={14} />
                                  <span>{template.subtasks.length} подзадач(и)</span>
                                </div>
                              )}
                            </div>

                            {template.subtasks?.length > 0 && (
                              <div className="template-subtasks">
                                <span className="subtasks-label">Подзадачи:</span>
                                <ul>
                                  {template.subtasks.map((st, idx) => (
                                    <li key={idx}>{st}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="template-footer">
                              <span className="created-info">
                                <Clock size={12} />
                                {formatDate(template.created_at)} · {template.created_by_name}
                              </span>
                            </div>

                            <div className="template-actions">
                              <button
                                className="use-btn"
                                onClick={() => handleUseTemplate(template)}
                                style={{ backgroundColor: moduleColor }}
                              >
                                Использовать
                              </button>
                              <button
                                className="edit-btn"
                                onClick={() => handleEditTemplate(template)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="delete-btn"
                                onClick={() => handleDeleteTemplate(template.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkTaskTemplateManager;
