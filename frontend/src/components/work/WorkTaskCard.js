/**
 * WorkTaskCard Component
 * Individual task card with metadata, real-time countdown, and actions
 */
import React, { useState } from 'react';
import {
  Clock, CheckCircle2, Circle, AlertCircle, User, Users, Building,
  MessageSquare, MoreVertical, Play, Check, Trash2, Edit, Image,
  AlertTriangle, Timer
} from 'lucide-react';
import WorkTaskCompleteModal from './WorkTaskCompleteModal';
import useCountdown from './useCountdown';

const WorkTaskCard = ({
  task,
  organizationId,
  currentUser,
  moduleColor = '#C2410C',
  onUpdate,
  onDelete,
  onDiscuss,
  compact = false
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Real-time countdown
  const { timeRemaining, isOverdue, urgencyLevel } = useCountdown(task.deadline);

  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 'URGENT': return { color: '#dc2626', label: 'Срочно', bg: '#fef2f2' };
      case 'HIGH': return { color: '#ea580c', label: 'Высокий', bg: '#fff7ed' };
      case 'MEDIUM': return { color: '#eab308', label: 'Средний', bg: '#fefce8' };
      default: return { color: '#22c55e', label: 'Низкий', bg: '#f0fdf4' };
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'NEW': return { icon: Circle, color: '#6b7280', label: 'Новая' };
      case 'ACCEPTED': return { icon: Play, color: '#3b82f6', label: 'Принято' };
      case 'IN_PROGRESS': return { icon: Clock, color: '#f59e0b', label: 'В работе' };
      case 'REVIEW': return { icon: AlertCircle, color: '#8b5cf6', label: 'На проверке' };
      case 'DONE': return { icon: CheckCircle2, color: '#22c55e', label: 'Готово' };
      default: return { icon: Circle, color: '#6b7280', label: status };
    }
  };

  const getUrgencyColor = () => {
    switch (urgencyLevel) {
      case 'overdue': return '#dc2626';
      case 'critical': return '#dc2626';
      case 'warning': return '#f59e0b';
      case 'soon': return '#eab308';
      default: return '#6b7280';
    }
  };

  const getAssignmentIcon = (type) => {
    switch (type) {
      case 'TEAM': return Users;
      case 'DEPARTMENT': return Building;
      default: return User;
    }
  };

  const handleAcceptTask = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/tasks/${task.id}/accept`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        onUpdate && onUpdate(data.task);
      }
    } catch (error) {
      console.error('Error accepting task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/tasks/${task.id}/status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        onUpdate && onUpdate(data.task);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Удалить эту задачу?')) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/tasks/${task.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        onDelete && onDelete(task.id);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const handleCreateDiscussion = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/work/organizations/${organizationId}/tasks/${task.id}/discuss`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        onDiscuss && onDiscuss(data.post_id);
      }
    } catch (error) {
      console.error('Error creating discussion:', error);
    }
  };

  const handleTaskCompleted = (completedTask) => {
    onUpdate && onUpdate(completedTask);
    setShowCompleteModal(false);
  };

  const priorityInfo = getPriorityInfo(task.priority);
  const statusInfo = getStatusInfo(task.status);
  const StatusIcon = statusInfo.icon;
  const AssignmentIcon = getAssignmentIcon(task.assignment_type);

  if (compact) {
    return (
      <div className="task-card compact" style={{ opacity: 0.7 }}>
        <CheckCircle2 size={16} color="#22c55e" />
        <span className="task-title-compact">{task.title}</span>
      </div>
    );
  }

  return (
    <div 
      className={`task-card ${task.is_overdue ? 'overdue' : ''}`}
      style={{ borderLeftColor: priorityInfo.color }}
    >
      {/* Header */}
      <div className="task-card-header">
        <div className="task-status" style={{ color: statusInfo.color }}>
          <StatusIcon size={14} />
          <span>{statusInfo.label}</span>
        </div>
        <div className="task-actions">
          <button
            className="task-action-btn"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical size={16} />
          </button>
          {showMenu && (
            <div className="task-menu">
              {task.can_edit && (
                <button onClick={() => { /* TODO: Edit modal */ setShowMenu(false); }}>
                  <Edit size={14} /> Редактировать
                </button>
              )}
              <button onClick={() => { handleCreateDiscussion(); setShowMenu(false); }}>
                <MessageSquare size={14} /> Обсудить
              </button>
              {task.can_delete && (
                <button className="danger" onClick={handleDeleteTask}>
                  <Trash2 size={14} /> Удалить
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="task-title">{task.title}</h4>

      {/* Meta Info */}
      <div className="task-meta">
        {/* Assignee */}
        <div className="task-meta-item">
          <AssignmentIcon size={14} />
          <span>
            {task.accepted_by_name || task.assigned_to_name || task.team_name || task.department_name || 'Не назначено'}
          </span>
        </div>

        {/* Deadline */}
        {task.deadline && (
          <div className={`task-meta-item ${task.is_overdue ? 'overdue' : ''}`}>
            <Clock size={14} />
            <span className="task-countdown">
              {task.time_remaining}
            </span>
          </div>
        )}

        {/* Priority */}
        <div 
          className="task-priority-badge"
          style={{ backgroundColor: priorityInfo.bg, color: priorityInfo.color }}
        >
          {priorityInfo.label}
        </div>
      </div>

      {/* Subtasks Progress */}
      {task.subtasks_total > 0 && (
        <div className="task-subtasks">
          <div className="subtasks-progress">
            <div 
              className="subtasks-bar"
              style={{ 
                width: `${(task.subtasks_completed / task.subtasks_total) * 100}%`,
                backgroundColor: moduleColor
              }}
            />
          </div>
          <span className="subtasks-count">
            {task.subtasks_completed}/{task.subtasks_total}
          </span>
        </div>
      )}

      {/* Photo Required Badge */}
      {task.requires_photo_proof && task.status !== 'DONE' && (
        <div className="photo-required-badge">
          <Image size={12} />
          <span>Требуется фото</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="task-card-actions">
        {task.can_accept && (
          <button
            className="task-btn accept"
            onClick={handleAcceptTask}
            disabled={loading}
            style={{ backgroundColor: moduleColor }}
          >
            <Check size={14} />
            Принять
          </button>
        )}

        {task.status === 'ACCEPTED' && task.can_complete && (
          <button
            className="task-btn progress"
            onClick={() => handleStatusChange('IN_PROGRESS')}
            disabled={loading}
            style={{ borderColor: moduleColor, color: moduleColor }}
          >
            <Play size={14} />
            Начать
          </button>
        )}

        {task.status === 'IN_PROGRESS' && task.can_complete && (
          <button
            className="task-btn complete"
            onClick={() => task.requires_photo_proof ? setShowCompleteModal(true) : handleStatusChange('DONE')}
            disabled={loading}
            style={{ backgroundColor: '#22c55e' }}
          >
            <CheckCircle2 size={14} />
            Завершить
          </button>
        )}

        <button
          className="task-btn discuss"
          onClick={handleCreateDiscussion}
        >
          <MessageSquare size={14} />
        </button>
      </div>

      {/* Complete Modal with Photo */}
      {showCompleteModal && (
        <WorkTaskCompleteModal
          task={task}
          organizationId={organizationId}
          moduleColor={moduleColor}
          onClose={() => setShowCompleteModal(false)}
          onComplete={handleTaskCompleted}
        />
      )}
    </div>
  );
};

export default WorkTaskCard;
