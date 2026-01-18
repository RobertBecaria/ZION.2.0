import React, { useState } from 'react';
import { X, UserPlus, Mail, Briefcase, Users, Shield, AlertCircle } from 'lucide-react';
import { WorkRoleTypes } from '../mock-work';

import { BACKEND_URL } from '../config/api';
const WorkInviteMemberModal = ({ organizationId, organizationName, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    user_email: '',
    role: 'EMPLOYEE',
    custom_role_name: '',
    department: '',
    team: '',
    job_title: '',
    can_invite: false,
    can_post: true,
    is_admin: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.user_email || !formData.job_title) {
      setError('Email и должность обязательны');
      return;
    }

    setLoading(true);
    setError(null);

    try {
            const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось добавить члена');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess && onSuccess();
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Error inviting member:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Пригласить в Организацию</h2>
            <p className="text-sm text-gray-600 mt-1">{organizationName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900">Член успешно добавлен!</h3>
                <p className="text-sm text-green-700 mt-1">Приглашение отправлено на email.</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Ошибка</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Email пользователя *
            </label>
            <input
              type="email"
              value={formData.user_email}
              onChange={(e) => handleChange('user_email', e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Пользователь должен быть зарегистрирован в системе</p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Shield className="w-4 h-4 inline mr-2" />
              Роль *
            </label>
            <select
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Briefcase className="w-4 h-4 inline mr-2" />
              Должность *
            </label>
            <input
              type="text"
              value={formData.job_title}
              onChange={(e) => handleChange('job_title', e.target.value)}
              placeholder="Менеджер проектов"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          {/* Department & Team */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-2" />
                Отдел
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="Разработка"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Команда</label>
              <input
                type="text"
                value={formData.team}
                onChange={(e) => handleChange('team', e.target.value)}
                placeholder="Backend Team"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Permissions */}
          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Права доступа</h3>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.can_post}
                  onChange={(e) => handleChange('can_post', e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                />
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors duration-200">
                    Может публиковать посты
                  </div>
                  <div className="text-sm text-gray-600">Разрешить создавать посты от имени организации</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.can_invite}
                  onChange={(e) => handleChange('can_invite', e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                />
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors duration-200">
                    Может приглашать членов
                  </div>
                  <div className="text-sm text-gray-600">Разрешить добавлять новых членов в организацию</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.is_admin}
                  onChange={(e) => handleChange('is_admin', e.target.checked)}
                  className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500"
                />
                <div>
                  <div className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors duration-200">
                    Администратор
                  </div>
                  <div className="text-sm text-gray-600">Полный доступ к настройкам и управлению организацией</div>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200 font-semibold text-gray-700"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Добавление...
                </>
              ) : success ? (
                'Добавлено!'
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Пригласить
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkInviteMemberModal;