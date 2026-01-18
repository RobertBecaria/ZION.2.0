import React, { useState, useEffect } from 'react';
import { X, Crown, AlertTriangle, Check, ChevronDown } from 'lucide-react';

import { BACKEND_URL } from '../config/api';
const WorkTransferOwnershipModal = ({ organizationId, organizationName, currentOwnerId, onClose, onSuccess }) => {
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [organizationId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
            const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Не удалось загрузить членов');

      const data = await response.json();
      // Filter to show only admins and not the current owner
      const eligibleMembers = data.members.filter(
        m => m.is_admin && m.user_id !== currentOwnerId
      );
      setMembers(eligibleMembers);
    } catch (error) {
      console.error('Error loading members:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedMemberId) {
      setError('Пожалуйста, выберите нового владельца');
      return;
    }

    setTransferring(true);
    setError(null);

    try {
            const token = localStorage.getItem('zion_token');

      const response = await fetch(
        `${BACKEND_URL}/api/work/organizations/${organizationId}/transfer-ownership`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ new_owner_id: selectedMemberId })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось передать владение');
      }

      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      console.error('Transfer ownership error:', error);
      setError(error.message);
    } finally {
      setTransferring(false);
    }
  };

  const selectedMember = members.find(m => m.user_id === selectedMemberId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Передать владение</h2>
              <p className="text-sm text-orange-100">{organizationName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors duration-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!showConfirm ? (
            <>
              {/* Warning */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-orange-900 mb-1">Важно!</h3>
                    <p className="text-sm text-orange-700">
                      Передача владения - это необратимое действие. Новый владелец получит полный контроль над организацией. Вы останетесь администратором.
                    </p>
                  </div>
                </div>
              </div>

              {/* Member Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите нового владельца
                </label>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="inline-block w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500 mt-2">Загрузка...</p>
                  </div>
                ) : members.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-6 text-center">
                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium mb-1">
                      Нет подходящих кандидатов
                    </p>
                    <p className="text-sm text-gray-500">
                      Назначьте хотя бы одного администратора перед передачей владения.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <button
                        key={member.user_id}
                        onClick={() => setSelectedMemberId(member.user_id)}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                          selectedMemberId === member.user_id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                        }`}
                      >
                        <img
                          src={member.user_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user_email}`}
                          alt={member.user_first_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 text-left">
                          <h4 className="font-semibold text-gray-900">
                            {member.user_first_name} {member.user_last_name}
                          </h4>
                          <p className="text-sm text-gray-600">{member.job_title || 'Член команды'}</p>
                        </div>
                        {selectedMemberId === member.user_id && (
                          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200"
                >
                  Отмена
                </button>
                <button
                  onClick={() => selectedMemberId && setShowConfirm(true)}
                  disabled={!selectedMemberId || members.length === 0}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Продолжить
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Final Confirmation */}
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-900 mb-2 text-lg">
                      Подтвердите передачу владения
                    </h3>
                    <p className="text-sm text-red-700 mb-4">
                      Вы уверены, что хотите передать владение организацией <strong>{organizationName}</strong> пользователю:
                    </p>
                    <div className="bg-white rounded-lg p-3 mb-4 flex items-center gap-3">
                      <img
                        src={selectedMember?.user_avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedMember?.user_email}`}
                        alt={selectedMember?.user_first_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {selectedMember?.user_first_name} {selectedMember?.user_last_name}
                        </h4>
                        <p className="text-xs text-gray-600">{selectedMember?.user_email}</p>
                      </div>
                    </div>
                    <p className="text-sm text-red-700">
                      Это действие <strong>нельзя отменить</strong>. Вы станете администратором.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Final Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={transferring}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50"
                >
                  Назад
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={transferring}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors duration-200 disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  {transferring ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Передача...
                    </>
                  ) : (
                    <>
                      <Crown className="w-5 h-5" />
                      Передать владение
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkTransferOwnershipModal;