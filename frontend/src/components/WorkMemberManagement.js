import React, { useState } from 'react';
import { Edit2, Trash2, Shield, Crown, Check, X, AlertTriangle, ChevronDown } from 'lucide-react';
import { WorkRoleTypes } from '../mock-work';

const WorkMemberManagement = ({ member, organizationId, isCurrentUser, isOwner, currentUserId, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: member.role,
    custom_role_name: member.custom_role_name || '',
    department: member.department || '',
    team: member.team || '',
    job_title: member.job_title || '',
    can_invite: member.can_invite || false,
    can_post: member.can_post !== false,
    is_admin: member.is_admin || false
  });

  const handleQuickAdminToggle = async () => {
    setQuickActionLoading(true);
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members/${member.user_id}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_admin: !member.is_admin })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось обновить роль');
      }

      onUpdate && onUpdate();
    } catch (error) {
      console.error('Error toggling admin:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setQuickActionLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members/${member.user_id}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось обновить члена');
      }

      setIsEditing(false);
      onUpdate && onUpdate();
    } catch (error) {
      console.error('Error updating member:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members/${member.user_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось удалить члена');
      }

      onRemove && onRemove();
    } catch (error) {
      console.error('Error removing member:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (showDeleteConfirm) {
    return (
      <div className="border-2 border-red-200 bg-red-50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900 mb-2">
              Удалить {member.user_first_name} {member.user_last_name}?
            </h3>
            <p className="text-sm text-red-700 mb-4">
              Это действие нельзя отменить. Член будет удален из организации.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium text-gray-700"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium flex items-center gap-2 disabled:bg-gray-300"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Удалить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="border-2 border-orange-200 bg-orange-50 rounded-xl p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">
              Редактирование: {member.user_first_name} {member.user_last_name}
            </h3>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
            <select
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {Object.keys(WorkRoleTypes).map(role => (
                <option key={role} value={role}>
                  {role.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Должность</label>
            <input
              type="text"
              value={formData.job_title}
              onChange={(e) => handleChange('job_title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Department & Team */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Отдел</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Команда</label>
              <input
                type="text"
                value={formData.team}
                onChange={(e) => handleChange('team', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.can_post}
                onChange={(e) => handleChange('can_post', e.target.checked)}
                className="w-4 h-4 text-orange-500 rounded"
              />
              <span className="text-sm text-gray-700">Может публиковать посты</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.can_invite}
                onChange={(e) => handleChange('can_invite', e.target.checked)}
                className="w-4 h-4 text-orange-500 rounded"
              />
              <span className="text-sm text-gray-700">Может приглашать членов</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_admin}
                onChange={(e) => handleChange('is_admin', e.target.checked)}
                className="w-4 h-4 text-orange-500 rounded"
              />
              <span className="text-sm text-gray-700 font-semibold">Администратор</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium text-gray-700"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-200 font-medium flex items-center justify-center gap-2 disabled:bg-gray-300"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Сохранение...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Сохранить
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View Mode
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all duration-200 bg-white">
      <img
        src={member.user_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_email}`}
        alt={member.user_first_name}
        className="w-12 h-12 rounded-full object-cover"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {member.user_first_name} {member.user_last_name}
              {isCurrentUser && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Вы
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 truncate">{member.job_title}</p>
          </div>
          
          {!isCurrentUser && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-lg hover:bg-orange-50 text-orange-600 transition-colors duration-200"
                title="Редактировать"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors duration-200"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {member.department && (
          <p className="text-xs text-gray-500 mb-2">
            {member.department}{member.team && ` • ${member.team}`}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {member.is_admin && (
            <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
              <Crown className="w-3 h-3" />
              Admin
            </span>
          )}
          {member.can_invite && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Can Invite
            </span>
          )}
          {member.can_post && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Can Post
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkMemberManagement;