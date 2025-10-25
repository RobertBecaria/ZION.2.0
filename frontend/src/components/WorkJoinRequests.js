import React, { useState, useEffect } from 'react';
import { Clock, Building2, XCircle, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

const WorkJoinRequests = ({ onBack, onViewProfile }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/join-requests/my-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load requests');
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

  const handleCancelRequest = async (requestId) => {
    setCancellingId(requestId);
    
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('zion_token');

      const response = await fetch(`${BACKEND_URL}/api/work/join-requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to cancel request');
      }

      // Remove from list
      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Cancel request error:', error);
      alert(error.message);
    } finally {
      setCancellingId(null);
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

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка запросов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-white/80 flex items-center justify-center transition-all duration-200 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Мои запросы</h1>
            <p className="text-gray-600 mt-1">Запросы на вступление в организации</p>
          </div>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Ожидают рассмотрения ({pendingRequests.length})
            </h2>
            <div className="space-y-4">
              {pendingRequests.map(request => (
                <div
                  key={request.id}
                  className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4 flex-1">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-7 h-7 text-white" />
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {request.organization_name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {request.organization_type.replace('_', ' ')}
                        </p>
                        {request.message && (
                          <p className="text-gray-700 mb-3 italic">"{request.message}"</p>
                        )}
                        <p className="text-sm text-gray-500">
                          Отправлено: {formatDate(request.requested_at)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelRequest(request.id)}
                      disabled={cancellingId === request.id}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {cancellingId === request.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          Отмена...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5" />
                          Отменить
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejected Requests */}
        {rejectedRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Отклонённые ({rejectedRequests.length})
            </h2>
            <div className="space-y-4">
              {rejectedRequests.map(request => (
                <div
                  key={request.id}
                  className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-red-500"
                >
                  <div className="flex gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-7 h-7 text-white" />
                    </div>

                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {request.organization_name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {request.organization_type.replace('_', ' ')}
                      </p>
                      {request.rejection_reason && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
                          <p className="text-sm text-red-700">
                            <span className="font-semibold">Причина отклонения:</span> {request.rejection_reason}
                          </p>
                        </div>
                      )}
                      <p className="text-sm text-gray-500">
                        Отправлено: {formatDate(request.requested_at)}
                      </p>
                      {request.reviewed_at && (
                        <p className="text-sm text-gray-500">
                          Рассмотрено: {formatDate(request.reviewed_at)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {requests.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Нет запросов</h3>
            <p className="text-gray-600 mb-6">
              У вас пока нет запросов на вступление в организации
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200"
            >
              Найти организации
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkJoinRequests;