import React, { useState, useEffect } from 'react';
import { Mail, Calendar, MapPin, Check, X, User } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const GoodWillInvitations = ({ 
  token, 
  moduleColor = '#8B5CF6',
  onSelectEvent 
}) => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvitations();
  }, [token]);

  const fetchInvitations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/my-invitations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const respondToInvitation = async (invitationId, accept) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/invitations/${invitationId}?accept=${accept}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setInvitations(invitations.filter(inv => inv.id !== invitationId));
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="spinner" style={{ borderTopColor: moduleColor }}></div>
        <p style={{ color: '#64748b', marginTop: '16px' }}>Загрузка...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '700', 
          color: '#1e293b', 
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '28px' }}>📨</span>
          Приглашения
        </h2>
        <p style={{ color: '#64748b', margin: 0 }}>
          Приглашения на мероприятия от других пользователей
        </p>
      </div>

      {invitations.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          background: '#f8fafc',
          borderRadius: '16px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📬</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>Нет новых приглашений</h3>
          <p style={{ color: '#64748b', margin: 0 }}>
            Когда вас пригласят, они появятся здесь
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {invitations.map(invitation => (
            <div
              key={invitation.id}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {/* Event Info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    marginBottom: '12px'
                  }}>
                    {invitation.event?.category && (
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: invitation.event.category.color + '20',
                        color: invitation.event.category.color,
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {invitation.event.category.icon} {invitation.event.category.name}
                      </span>
                    )}
                  </div>

                  <h3 
                    style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '18px', 
                      fontWeight: '600',
                      color: '#1e293b',
                      cursor: 'pointer'
                    }}
                    onClick={() => onSelectEvent?.({ id: invitation.event_id })}
                  >
                    {invitation.event?.title || 'Мероприятие'}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#64748b' }}>
                    {invitation.event?.start_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        {formatDate(invitation.event.start_date)}
                      </div>
                    )}
                    {invitation.event?.city && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} />
                        {invitation.event.city}
                      </div>
                    )}
                  </div>

                  {/* Inviter */}
                  <div style={{ 
                    marginTop: '12px', 
                    paddingTop: '12px', 
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {invitation.inviter?.profile_picture ? (
                      <img 
                        src={invitation.inviter.profile_picture} 
                        alt="" 
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ 
                        width: '28px', 
                        height: '28px', 
                        borderRadius: '50%', 
                        background: '#e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <User size={14} color="#64748b" />
                      </div>
                    )}
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      Приглашает: {invitation.inviter?.first_name} {invitation.inviter?.last_name}
                    </span>
                  </div>

                  {invitation.message && (
                    <div style={{ 
                      marginTop: '12px', 
                      padding: '10px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#64748b',
                      fontStyle: 'italic'
                    }}>
                      "                      &ldquo;{invitation.message}&rdquo;"
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                  <button
                    onClick={() => respondToInvitation(invitation.id, true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      background: '#10B981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={16} />
                    Принять
                  </button>
                  <button
                    onClick={() => respondToInvitation(invitation.id, false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      background: '#f1f5f9',
                      color: '#64748b',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                    Отклонить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoodWillInvitations;
