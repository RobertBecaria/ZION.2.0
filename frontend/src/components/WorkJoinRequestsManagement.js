import React, { useState, useEffect } from 'react';
import { User, Mail, Clock, Check, X, MessageSquare, AlertCircle } from 'lucide-react';
import { toast } from '../utils/animations';

import { BACKEND_URL } from '../config/api';
const WorkJoinRequestsManagement = ({ organizationId, organizationName }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (organizationId) {
      loadRequests();
    }
  }, [organizationId]);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);

    try {
            const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/organizations/${organizationId}/join-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось загрузить запросы');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Load requests error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);

    try {
            const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/join-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'Member' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось одобрить запрос');
      }

      // Remove from list
      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Approve error:', error);
      toast.error(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClick = (requestId) => {
    setRejectRequestId(requestId);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectRequestId) return;

    setProcessingId(rejectRequestId);

    try {
            const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/join-requests/${rejectRequestId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rejection_reason: rejectionReason || null })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Не удалось отклонить запрос');
      }

      // Remove from list
      setRequests(prev => prev.filter(req => req.id !== rejectRequestId));
      setShowRejectModal(false);
      setRejectRequestId(null);
    } catch (error) {
      console.error('Reject error:', error);
      toast.error(error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка запросов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ошибка загрузки</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadRequests}
            className="px-6 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors duration-200 font-semibold"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Нет запросов</h3>
          <p className="text-gray-600">
            В данный момент нет запросов на вступление в организацию
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Запросы на вступление ({requests.length})
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Рассмотрите запросы пользователей на присоединение к "{organizationName}"
        </p>
      </div>

      {requests.map(request => (
        <div
          key={request.id}
          className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-start justify-between">
            <div className="flex gap-4 flex-1">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-white" />
              </div>

              {/* Info */}
              <div className="flex-1">
                <h4 className="text-lg font-bold text-gray-900 mb-1">
                  {request.user_name}
                </h4>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Mail className="w-4 h-4" />
                  {request.user_email}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Clock className="w-4 h-4" />
                  Отправлено: {formatDate(request.requested_at)}
                </div>

                {/* Message */}
                {request.message && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700 italic">&ldquo;{request.message}&rdquo;</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(request.id)}
                    disabled={processingId === request.id}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {processingId === request.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Обработка...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Одобрить
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleRejectClick(request.id)}
                    disabled={processingId === request.id}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Отклонить запрос</h3>
            </div>

            <p className="text-gray-600 mb-4">
              Вы можете указать причину отклонения (необязательно)
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Причина отклонения..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectRequestId(null);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors duration-200 font-semibold text-gray-700"
              >
                Отмена
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={processingId === rejectRequestId}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingId === rejectRequestId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Отклонение...
                  </>
                ) : (
                  'Отклонить запрос'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkJoinRequestsManagement;