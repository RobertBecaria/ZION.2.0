/**
 * ServicesBookings Component
 * Manage bookings for both clients and providers
 */
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, User, Building2, Check, X, Phone, Mail,
  ChevronDown, Filter, Loader2, MessageCircle, AlertCircle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  PENDING: { label: 'Ожидает', color: '#f59e0b', bg: '#f59e0b15' },
  CONFIRMED: { label: 'Подтверждена', color: '#10b981', bg: '#10b98115' },
  CANCELLED: { label: 'Отменена', color: '#ef4444', bg: '#ef444415' },
  COMPLETED: { label: 'Завершена', color: '#6366f1', bg: '#6366f115' },
  NO_SHOW: { label: 'Не пришёл', color: '#6b7280', bg: '#6b728015' }
};

const ServicesBookings = ({
  user,
  moduleColor = '#B91C1C',
  asProvider = false
}) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState(asProvider ? 'provider' : 'client');
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, [viewMode, statusFilter]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const params = new URLSearchParams();
      params.append('as_provider', viewMode === 'provider');
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await fetch(`${BACKEND_URL}/api/services/bookings/my?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId, newStatus) => {
    setUpdatingStatus(bookingId);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/services/bookings/${bookingId}/status?new_status=${newStatus}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        fetchBookings();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }),
      time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const groupBookingsByDate = () => {
    const groups = {};
    bookings.forEach(booking => {
      const dateKey = new Date(booking.booking_date).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(booking);
    });
    return groups;
  };

  const groupedBookings = groupBookingsByDate();

  return (
    <div className="services-bookings">
      {/* Header */}
      <div className="bookings-header">
        <div>
          <h2 style={{ color: moduleColor }}>📋 Мои заявки</h2>
          <p>Управление записями и бронированиями</p>
        </div>
      </div>

      {/* View Toggle & Filters */}
      <div className="bookings-controls">
        <div className="view-toggle">
          <button
            className={viewMode === 'client' ? 'active' : ''}
            onClick={() => setViewMode('client')}
            style={viewMode === 'client' ? { backgroundColor: moduleColor } : {}}
          >
            <User size={16} />
            Мои записи
          </button>
          <button
            className={viewMode === 'provider' ? 'active' : ''}
            onClick={() => setViewMode('provider')}
            style={viewMode === 'provider' ? { backgroundColor: moduleColor } : {}}
          >
            <Building2 size={16} />
            Заявки клиентов
          </button>
        </div>
        
        <div className="status-filter">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="PENDING">Ожидают</option>
            <option value="CONFIRMED">Подтверждённые</option>
            <option value="COMPLETED">Завершённые</option>
            <option value="CANCELLED">Отменённые</option>
          </select>
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="bookings-loading">
          <Loader2 size={32} className="spin" style={{ color: moduleColor }} />
          <p>Загрузка записей...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bookings-empty">
          <Calendar size={48} style={{ color: '#9ca3af' }} />
          <h3>{viewMode === 'client' ? 'У вас пока нет записей' : 'Нет заявок от клиентов'}</h3>
          <p>{viewMode === 'client' 
            ? 'Найдите услугу и запишитесь онлайн'
            : 'Когда клиенты запишутся к вам, заявки появятся здесь'}
          </p>
        </div>
      ) : (
        <div className="bookings-list">
          {Object.entries(groupedBookings).map(([dateKey, dateBookings]) => (
            <div key={dateKey} className="bookings-date-group">
              <h3 className="date-header">
                <Calendar size={16} />
                {new Date(dateKey).toLocaleDateString('ru-RU', { 
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </h3>
              
              {dateBookings.map(booking => {
                const { date, time } = formatDateTime(booking.booking_date);
                const status = STATUS_LABELS[booking.status] || STATUS_LABELS.PENDING;
                const isExpanded = expandedBooking === booking.id;
                
                return (
                  <div key={booking.id} className={`booking-card ${isExpanded ? 'expanded' : ''}`}>
                    <div 
                      className="booking-main"
                      onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                    >
                      <div className="booking-time">
                        <Clock size={18} />
                        <span>{time}</span>
                      </div>
                      
                      <div className="booking-info">
                        <h4>{booking.service_name || 'Услуга'}</h4>
                        <p>{booking.organization_name}</p>
                        {viewMode === 'provider' && (
                          <span className="client-name">
                            <User size={14} /> {booking.client_name}
                          </span>
                        )}
                      </div>
                      
                      <div 
                        className="booking-status"
                        style={{ backgroundColor: status.bg, color: status.color }}
                      >
                        {status.label}
                      </div>
                      
                      <ChevronDown 
                        size={20} 
                        className={`expand-icon ${isExpanded ? 'rotated' : ''}`}
                      />
                    </div>
                    
                    {isExpanded && (
                      <div className="booking-details">
                        <div className="details-grid">
                          {viewMode === 'provider' && (
                            <>
                              <div className="detail-item">
                                <User size={16} />
                                <div>
                                  <label>Клиент</label>
                                  <span>{booking.client_name}</span>
                                </div>
                              </div>
                              
                              {booking.client_phone && (
                                <div className="detail-item">
                                  <Phone size={16} />
                                  <div>
                                    <label>Телефон</label>
                                    <a href={`tel:${booking.client_phone}`}>{booking.client_phone}</a>
                                  </div>
                                </div>
                              )}
                              
                              {booking.client_email && (
                                <div className="detail-item">
                                  <Mail size={16} />
                                  <div>
                                    <label>Email</label>
                                    <a href={`mailto:${booking.client_email}`}>{booking.client_email}</a>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          
                          {booking.client_notes && (
                            <div className="detail-item full-width">
                              <MessageCircle size={16} />
                              <div>
                                <label>Комментарий</label>
                                <span>{booking.client_notes}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Actions */}
                        {booking.status === 'PENDING' && (
                          <div className="booking-actions">
                            {viewMode === 'provider' ? (
                              <>
                                <button
                                  className="confirm-btn"
                                  onClick={() => handleUpdateStatus(booking.id, 'CONFIRMED')}
                                  disabled={updatingStatus === booking.id}
                                >
                                  <Check size={16} /> Подтвердить
                                </button>
                                <button
                                  className="cancel-btn"
                                  onClick={() => handleUpdateStatus(booking.id, 'CANCELLED')}
                                  disabled={updatingStatus === booking.id}
                                >
                                  <X size={16} /> Отклонить
                                </button>
                              </>
                            ) : (
                              <button
                                className="cancel-btn"
                                onClick={() => handleUpdateStatus(booking.id, 'CANCELLED')}
                                disabled={updatingStatus === booking.id}
                              >
                                <X size={16} /> Отменить запись
                              </button>
                            )}
                          </div>
                        )}
                        
                        {booking.status === 'CONFIRMED' && viewMode === 'provider' && (
                          <div className="booking-actions">
                            <button
                              className="complete-btn"
                              onClick={() => handleUpdateStatus(booking.id, 'COMPLETED')}
                              disabled={updatingStatus === booking.id}
                              style={{ backgroundColor: moduleColor }}
                            >
                              <Check size={16} /> Отметить выполненной
                            </button>
                            <button
                              className="no-show-btn"
                              onClick={() => handleUpdateStatus(booking.id, 'NO_SHOW')}
                              disabled={updatingStatus === booking.id}
                            >
                              <AlertCircle size={16} /> Клиент не пришёл
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesBookings;
