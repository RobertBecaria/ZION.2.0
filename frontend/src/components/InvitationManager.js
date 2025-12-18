import React, { useState, useEffect } from 'react';
import { 
  Mail, Clock, CheckCircle, XCircle, Users, AlertCircle, 
  ArrowRight, Calendar, User, Shield, Baby, Trash2, 
  RefreshCw, ExternalLink, Home, MessageCircle
} from 'lucide-react';

const InvitationManager = ({ currentUser }) => {
  const [invitations, setInvitations] = useState({
    received: [],
    sent: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('received');
  const [processingInvitation, setProcessingInvitation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }
      
      // Fetch received invitations
      const receivedResponse = await fetch(`${backendUrl}/api/family-invitations/received`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Fetch sent invitations
      const sentResponse = await fetch(`${backendUrl}/api/family-invitations/sent`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (receivedResponse.ok && sentResponse.ok) {
        const receivedData = await receivedResponse.json();
        const sentData = await sentResponse.json();
        
        setInvitations({
          received: receivedData.invitations || [],
          sent: sentData.invitations || []
        });
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
      setError('Не удалось загрузить приглашения');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationResponse = async (invitationId, action) => {
    setProcessingInvitation(invitationId);
    setError('');

    try {
      const token = localStorage.getItem('zion_token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }
      
      const response = await fetch(`${backendUrl}/api/family-invitations/${invitationId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Refresh invitations after action
        await fetchInvitations();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || `Не удалось ${action === 'accept' ? 'принять' : 'отклонить'} приглашение`);
      }
    } catch (error) {
      console.error('Error processing invitation:', error);
      setError('Произошла ошибка при обработке приглашения');
    } finally {
      setProcessingInvitation(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'ACCEPTED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'DECLINED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'PENDING': 'Ожидает ответа',
      'ACCEPTED': 'Принято',
      'DECLINED': 'Отклонено',
      'EXPIRED': 'Истекло'
    };
    return labels[status] || status;
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'CHILD':
        return <Baby className="w-4 h-4 text-purple-500" />;
      default:
        return <User className="w-4 h-4 text-green-500" />;
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      'ADMIN': 'Администратор',
      'MEMBER': 'Член семьи',
      'CHILD': 'Ребенок'
    };
    return labels[role] || role;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt) => {
    return expiresAt && new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Семейные приглашения</h1>
        <p className="text-gray-600">
          Управляйте приглашениями в семейные профили
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'received', label: 'Полученные', count: invitations.received.length },
            { key: 'sent', label: 'Отправленные', count: invitations.sent.length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  activeTab === tab.key
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'received' && (
        <div className="space-y-4">
          {invitations.received.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет полученных приглашений
              </h3>
              <p className="text-gray-600">
                Когда вас пригласят в семейный профиль, приглашения появятся здесь
              </p>
            </div>
          ) : (
            invitations.received.map((invitation) => (
              <div key={invitation.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Invitation Header */}
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <Home className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Приглашение в семью &ldquo;{invitation.family_name}&rdquo;
                        </h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <span>От: {invitation.invited_by_name}</span>
                          <span>•</span>
                          <span>{formatDate(invitation.sent_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invitation Details */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Роль в семье:</p>
                          <div className="flex items-center space-x-2 mt-1">
                            {getRoleIcon(invitation.invitation_type)}
                            <span className="text-sm text-gray-900">
                              {getRoleLabel(invitation.invitation_type)}
                            </span>
                          </div>
                        </div>
                        {invitation.relationship_to_family && (
                          <div>
                            <p className="text-sm font-medium text-gray-700">Родственная связь:</p>
                            <p className="text-sm text-gray-900 mt-1">
                              {invitation.relationship_to_family}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Personal Message */}
                    {invitation.message && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-start space-x-2">
                          <MessageCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-900">Персональное сообщение:</p>
                            <p className="text-sm text-blue-700 mt-1">{invitation.message}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status & Expiry */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(invitation.status)}
                        <span className="text-sm font-medium text-gray-700">
                          {getStatusLabel(invitation.status)}
                        </span>
                      </div>
                      
                      {invitation.expires_at && !isExpired(invitation.expires_at) && (
                        <p className="text-xs text-gray-500">
                          Истекает: {formatDate(invitation.expires_at)}
                        </p>
                      )}
                      
                      {isExpired(invitation.expires_at) && (
                        <span className="text-xs text-red-500 font-medium">
                          Приглашение истекло
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {invitation.status === 'PENDING' && !isExpired(invitation.expires_at) && (
                    <div className="flex flex-col space-y-2 ml-6">
                      <button
                        onClick={() => handleInvitationResponse(invitation.id, 'accept')}
                        disabled={processingInvitation === invitation.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {processingInvitation === invitation.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        <span>Принять</span>
                      </button>
                      
                      <button
                        onClick={() => handleInvitationResponse(invitation.id, 'decline')}
                        disabled={processingInvitation === invitation.id}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Отклонить</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="space-y-4">
          {invitations.sent.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет отправленных приглашений
              </h3>
              <p className="text-gray-600">
                Приглашения, которые вы отправите, будут отображаться здесь
              </p>
            </div>
          ) : (
            invitations.sent.map((invitation) => (
              <div key={invitation.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Invitation Header */}
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Mail className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {invitation.invited_user_email}
                        </h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <span>Семья: {invitation.family_name}</span>
                          <span>•</span>
                          <span>{formatDate(invitation.sent_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invitation Details */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(invitation.invitation_type)}
                          <span className="text-sm text-gray-700">
                            {getRoleLabel(invitation.invitation_type)}
                          </span>
                        </div>
                        
                        {invitation.relationship_to_family && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-700">
                              {invitation.relationship_to_family}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {getStatusIcon(invitation.status)}
                        <span className="text-sm font-medium text-gray-700">
                          {getStatusLabel(invitation.status)}
                        </span>
                      </div>
                    </div>

                    {/* Status Details */}
                    {invitation.status === 'PENDING' && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          Приглашение отправлено и ожидает ответа
                          {invitation.expires_at && (
                            <span className="block mt-1">
                              Истекает: {formatDate(invitation.expires_at)}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {invitation.status === 'ACCEPTED' && invitation.responded_at && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          Приглашение принято {formatDate(invitation.responded_at)}
                        </p>
                      </div>
                    )}

                    {invitation.status === 'DECLINED' && invitation.responded_at && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                          Приглашение отклонено {formatDate(invitation.responded_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-8 text-center">
        <button
          onClick={fetchInvitations}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Обновить</span>
        </button>
      </div>
    </div>
  );
};

export default InvitationManager;