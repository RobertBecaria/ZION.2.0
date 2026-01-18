import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, User, AlertCircle, Briefcase, Users, UserPlus } from 'lucide-react';

import { BACKEND_URL } from '../config/api';
const WorkChangeRequestsManager = ({ organizationId, onRequestHandled }) => {
    const API = `${BACKEND_URL}/api`;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [changeRequests, setChangeRequests] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [requestType, setRequestType] = useState('change'); // 'change' or 'join'
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  useEffect(() => {
    if (requestType === 'change') {
      fetchChangeRequests();
    } else {
      fetchJoinRequests();
    }
  }, [organizationId, statusFilter, requestType]);
  
  const fetchChangeRequests = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${API}/work/organizations/${organizationId}/change-requests?status=${statusFilter}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при загрузке запросов');
      }
      
      setChangeRequests(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchJoinRequests = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${API}/work/organizations/${organizationId}/join-requests`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при загрузке запросов на вступление');
      }
      
      // Filter by status if needed
      let filteredRequests = data.requests || [];
      if (statusFilter.toLowerCase() !== 'pending') {
        filteredRequests = filteredRequests.filter(r => 
          r.status.toLowerCase() === statusFilter.toLowerCase()
        );
      }
      
      setJoinRequests(filteredRequests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async (requestId) => {
    try {
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${API}/work/organizations/${organizationId}/change-requests/${requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при одобрении запроса');
      }
      
      // Refresh list
      fetchChangeRequests();
      // Notify parent component
      if (onRequestHandled) onRequestHandled();
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleApproveJoinRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${API}/work/join-requests/${requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ role: 'MEMBER' })
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при одобрении запроса на вступление');
      }
      
      // Refresh list
      fetchJoinRequests();
      // Notify parent component
      if (onRequestHandled) onRequestHandled();
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleReject = async (requestId) => {
    try {
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${API}/work/organizations/${organizationId}/change-requests/${requestId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rejection_reason: rejectionReason })
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при отклонении запроса');
      }
      
      // Refresh list and close modal
      setRejectingRequest(null);
      setRejectionReason('');
      fetchChangeRequests();
      // Notify parent component
      if (onRequestHandled) onRequestHandled();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectJoinRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(
        `${API}/work/join-requests/${requestId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ rejection_reason: rejectionReason })
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ошибка при отклонении запроса на вступление');
      }
      
      // Refresh list and close modal
      setRejectingRequest(null);
      setRejectionReason('');
      fetchJoinRequests();
      // Notify parent component
      if (onRequestHandled) onRequestHandled();
    } catch (err) {
      setError(err.message);
    }
  };
  
  const getRequestTypeLabel = (type) => {
    const labels = {
      'ROLE_CHANGE': 'Изменение роли',
      'DEPARTMENT_CHANGE': 'Изменение отдела',
      'TEAM_CHANGE': 'Изменение команды',
      'JOB_TITLE_CHANGE': 'Изменение должности',
      'PERMISSIONS_CHANGE': 'Изменение прав'
    };
    return labels[type] || type;
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="work-change-requests">
      <div className="requests-header">
        <h3><Clock size={20} /> Запросы на изменения</h3>
        <div className="request-type-selector">
          <button
            className={requestType === 'change' ? 'active' : ''}
            onClick={() => setRequestType('change')}
          >
            <Briefcase size={16} /> Изменения
          </button>
          <button
            className={requestType === 'join' ? 'active' : ''}
            onClick={() => setRequestType('join')}
          >
            <UserPlus size={16} /> Вступления
          </button>
        </div>
        <div className="status-filter">
          <button
            className={statusFilter === 'PENDING' ? 'active' : ''}
            onClick={() => setStatusFilter('PENDING')}
          >
            <Clock size={16} /> Ожидание
          </button>
          <button
            className={statusFilter === 'APPROVED' ? 'active' : ''}
            onClick={() => setStatusFilter('APPROVED')}
          >
            <CheckCircle size={16} /> Одобрено
          </button>
          <button
            className={statusFilter === 'REJECTED' ? 'active' : ''}
            onClick={() => setStatusFilter('REJECTED')}
          >
            <XCircle size={16} /> Отклонено
          </button>
        </div>
      </div>
      
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Загрузка запросов...</p>
        </div>
      )}
      
      {!loading && (requestType === 'change' ? changeRequests : joinRequests).length === 0 && (
        <div className="empty-state">
          <Clock size={48} style={{ opacity: 0.3 }} />
          <p>Нет запросов со статусом "{statusFilter === 'PENDING' ? 'Ожидание' : statusFilter === 'APPROVED' ? 'Одобрено' : 'Отклонено'}"</p>
        </div>
      )}
      
      {!loading && (requestType === 'change' ? changeRequests : joinRequests).length > 0 && (
        <div className="requests-list">
          {(requestType === 'change' ? changeRequests : joinRequests).map((request) => (
            <div key={request.id} className="request-card">
              <div className="request-header">
                <div className="user-info">
                  <div className="avatar">
                    {(requestType === 'change' ? request.user_avatar_url : request.avatar_url) ? (
                      <img src={requestType === 'change' ? request.user_avatar_url : request.avatar_url} alt={requestType === 'change' ? request.user_first_name : request.first_name} />
                    ) : (
                      <div className="avatar-placeholder">
                        {(requestType === 'change' ? request.user_first_name : request.first_name)?.[0]}{(requestType === 'change' ? request.user_last_name : request.last_name)?.[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4>{requestType === 'change' ? `${request.user_first_name} ${request.user_last_name}` : `${request.first_name} ${request.last_name}`}</h4>
                    <p className="email">{requestType === 'change' ? request.user_email : request.email}</p>
                  </div>
                </div>
                <div className="request-type">
                  {requestType === 'change' ? getRequestTypeLabel(request.request_type) : 'Запрос на вступление'}
                </div>
              </div>
              
              <div className="request-body">
                {requestType === 'change' ? (
                  <div className="change-details">
                    {request.request_type === 'ROLE_CHANGE' && (
                      <div className="change-item">
                        <Briefcase size={16} />
                        <span className="current">{request.current_role}</span>
                        <span className="arrow">→</span>
                        <span className="requested">{request.requested_role}</span>
                      </div>
                    )}
                    
                    {request.request_type === 'DEPARTMENT_CHANGE' && (
                      <div className="change-item">
                        <Users size={16} />
                        <span className="current">{request.current_department || 'Не указан'}</span>
                        <span className="arrow">→</span>
                        <span className="requested">{request.requested_department}</span>
                      </div>
                    )}
                    
                    {request.request_type === 'TEAM_CHANGE' && (
                      <div className="change-item">
                        <Users size={16} />
                        <span className="current">{request.current_team || 'Не указана'}</span>
                        <span className="arrow">→</span>
                        <span className="requested">{request.requested_team}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="join-details">
                    <div className="join-item">
                      <UserPlus size={16} />
                      <span>Запрос на вступление в организацию</span>
                    </div>
                    {request.message && (
                      <div className="join-message">
                        <strong>Сообщение:</strong> {request.message}
                      </div>
                    )}
                  </div>
                )}
                
                {request.reason && (
                  <div className="reason">
                    <strong>Причина:</strong> {request.reason}
                  </div>
                )}
                
                <div className="request-meta">
                  <span className="date">Создано: {formatDate(requestType === 'change' ? request.created_at : request.requested_at)}</span>
                  {request.reviewed_at && (
                    <span className="date">Рассмотрено: {formatDate(request.reviewed_at)}</span>
                  )}
                </div>
                
                {request.rejection_reason && (
                  <div className="rejection-reason">
                    <AlertCircle size={16} />
                    <strong>Причина отклонения:</strong> {request.rejection_reason}
                  </div>
                )}
              </div>
              
              {statusFilter === 'PENDING' && (
                <div className="request-actions">
                  <button
                    onClick={() => requestType === 'change' ? handleApprove(request.id) : handleApproveJoinRequest(request.id)}
                    className="btn-approve"
                  >
                    <CheckCircle size={18} />
                    Одобрить
                  </button>
                  <button
                    onClick={() => setRejectingRequest(request.id)}
                    className="btn-reject"
                  >
                    <XCircle size={18} />
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Rejection Modal */}
      {rejectingRequest && (
        <div className="modal-overlay" onClick={() => setRejectingRequest(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Отклонить запрос</h3>
              <button onClick={() => setRejectingRequest(null)} className="modal-close">
                <XCircle size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label>Причина отклонения (опционально)</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Объясните, почему запрос отклонен..."
                rows={4}
                className="settings-textarea"
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => requestType === 'change' ? handleReject(rejectingRequest) : handleRejectJoinRequest(rejectingRequest)}
                className="btn-danger"
              >
                Отклонить запрос
              </button>
              <button
                onClick={() => {
                  setRejectingRequest(null);
                  setRejectionReason('');
                }}
                className="btn-secondary"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkChangeRequestsManager;
