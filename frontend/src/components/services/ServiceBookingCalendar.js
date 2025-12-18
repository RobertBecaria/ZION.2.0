/**
 * ServiceBookingCalendar Component
 * FullCalendar-based booking system for service providers
 */
import React, { useState, useEffect, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { 
  Calendar, Clock, Check, X, ChevronLeft, ChevronRight,
  User, Phone, Mail, MessageCircle, Loader2, Settings,
  Plus, Edit2, Trash2, CalendarDays
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  PENDING: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  CONFIRMED: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  CANCELLED: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
  COMPLETED: { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' },
  NO_SHOW: { bg: '#F3F4F6', border: '#6B7280', text: '#374151' }
};

const ServiceBookingCalendar = ({
  user,
  serviceId,
  serviceName,
  isProvider = false,
  moduleColor = '#B91C1C',
  onBack,
  onBookingCreated
}) => {
  const [bookings, setBookings] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAvailabilitySettings, setShowAvailabilitySettings] = useState(false);
  const [calendarView, setCalendarView] = useState('timeGridWeek');
  
  // Booking form state
  const [bookingForm, setBookingForm] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientNotes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Provider availability settings
  const [availability, setAvailability] = useState({
    monday: { open: '09:00', close: '18:00', enabled: true },
    tuesday: { open: '09:00', close: '18:00', enabled: true },
    wednesday: { open: '09:00', close: '18:00', enabled: true },
    thursday: { open: '09:00', close: '18:00', enabled: true },
    friday: { open: '09:00', close: '18:00', enabled: true },
    saturday: { open: '10:00', close: '15:00', enabled: false },
    sunday: { open: '00:00', close: '00:00', enabled: false }
  });

  const fetchBookings = useCallback(async () => {
    try {
      const token = localStorage.getItem('zion_token');
      const params = new URLSearchParams();
      if (serviceId) params.append('service_id', serviceId);
      params.append('as_provider', isProvider);
      
      const response = await fetch(`${BACKEND_URL}/api/services/bookings/my?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Transform bookings to FullCalendar events
        const events = (data.bookings || []).map(booking => {
          const colors = STATUS_COLORS[booking.status] || STATUS_COLORS.PENDING;
          return {
            id: booking.id,
            title: isProvider ? booking.client_name : (booking.service_name || 'Услуга'),
            start: booking.booking_date,
            end: new Date(new Date(booking.booking_date).getTime() + (booking.duration_minutes || 60) * 60000).toISOString(),
            backgroundColor: colors.bg,
            borderColor: colors.border,
            textColor: colors.text,
            extendedProps: { ...booking }
          };
        });
        setBookings(events);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  }, [serviceId, isProvider]);

  const fetchAvailableSlots = useCallback(async (date) => {
    if (!serviceId) return;
    
    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await fetch(`${BACKEND_URL}/api/services/bookings/available-slots/${serviceId}?date=${dateStr}`);
      
      if (response.ok) {
        const data = await response.json();
        setAvailableSlots(data.slots || []);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!isProvider && serviceId) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate, isProvider, serviceId, fetchAvailableSlots]);

  const handleDateClick = (info) => {
    setSelectedDate(new Date(info.date));
    if (!isProvider && serviceId) {
      fetchAvailableSlots(new Date(info.date));
    }
  };

  const handleEventClick = (info) => {
    setSelectedBooking(info.event.extendedProps);
  };

  const handleSlotSelect = (slot) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
    setShowBookingModal(true);
  };

  const handleCreateBooking = async () => {
    if (!selectedSlot || !serviceId) return;
    
    setSubmitting(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/services/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_id: serviceId,
          booking_date: selectedSlot.start,
          client_name: bookingForm.clientName || `${user?.first_name} ${user?.last_name}`,
          client_phone: bookingForm.clientPhone || user?.phone || '',
          client_email: bookingForm.clientEmail || user?.email || '',
          client_notes: bookingForm.clientNotes
        })
      });
      
      if (response.ok) {
        setShowBookingModal(false);
        setSelectedSlot(null);
        setBookingForm({ clientName: '', clientPhone: '', clientEmail: '', clientNotes: '' });
        fetchBookings();
        fetchAvailableSlots(selectedDate);
        if (onBookingCreated) onBookingCreated();
      }
    } catch (error) {
      console.error('Error creating booking:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/services/bookings/${bookingId}/status?new_status=${newStatus}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setSelectedBooking(null);
        fetchBookings();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const renderEventContent = (eventInfo) => {
    const status = eventInfo.event.extendedProps.status;
    return (
      <div className="fc-event-content">
        <span className="fc-event-time">
          {eventInfo.timeText}
        </span>
        <span className="fc-event-title">
          {eventInfo.event.title}
        </span>
        {status && (
          <span className={`fc-event-status ${status.toLowerCase()}`}>
            {status === 'PENDING' ? '⏳' : status === 'CONFIRMED' ? '✓' : ''}
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="booking-calendar-loading">
        <Loader2 size={32} className="spin" style={{ color: moduleColor }} />
        <p>Загрузка календаря...</p>
      </div>
    );
  }

  return (
    <div className="service-booking-calendar">
      {/* Header */}
      <div className="calendar-header">
        <div className="header-left">
          {onBack && (
            <button className="back-btn" onClick={onBack}>
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <h2 style={{ color: moduleColor }}>
              <CalendarDays size={24} />
              {isProvider ? 'Календарь записей' : 'Записаться онлайн'}
            </h2>
            {serviceName && <p className="service-name">{serviceName}</p>}
          </div>
        </div>
        
        <div className="header-actions">
          {isProvider && (
            <button 
              className="settings-btn"
              onClick={() => setShowAvailabilitySettings(true)}
            >
              <Settings size={18} />
              Настройки
            </button>
          )}
          
          <div className="view-switcher">
            <button 
              className={calendarView === 'dayGridMonth' ? 'active' : ''}
              onClick={() => setCalendarView('dayGridMonth')}
            >
              Месяц
            </button>
            <button 
              className={calendarView === 'timeGridWeek' ? 'active' : ''}
              onClick={() => setCalendarView('timeGridWeek')}
            >
              Неделя
            </button>
            <button 
              className={calendarView === 'timeGridDay' ? 'active' : ''}
              onClick={() => setCalendarView('timeGridDay')}
            >
              День
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="calendar-content">
        {/* Calendar */}
        <div className="calendar-main">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={calendarView}
            key={calendarView}
            locale="ru"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            buttonText={{
              today: 'Сегодня',
              month: 'Месяц',
              week: 'Неделя',
              day: 'День'
            }}
            events={bookings}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={renderEventContent}
            selectable={!isProvider}
            selectMirror={true}
            dayMaxEvents={3}
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            slotDuration="00:30:00"
            allDaySlot={false}
            nowIndicator={true}
            height="auto"
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }}
          />
        </div>

        {/* Available Slots Panel (for clients) */}
        {!isProvider && serviceId && (
          <div className="slots-panel">
            <h3>
              <Clock size={18} />
              Доступное время на {selectedDate.toLocaleDateString('ru-RU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </h3>
            
            {availableSlots.length === 0 ? (
              <div className="no-slots">
                <p>Нет доступных слотов на эту дату</p>
              </div>
            ) : (
              <div className="slots-grid">
                {availableSlots.map((slot, idx) => {
                  const time = new Date(slot.start).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <button
                      key={idx}
                      className={`slot-btn ${!slot.available ? 'unavailable' : ''} ${selectedSlot?.start === slot.start ? 'selected' : ''}`}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={!slot.available}
                      style={slot.available ? { '--slot-color': moduleColor } : {}}
                    >
                      {time}
                      {!slot.available && <span className="booked-label">Занято</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="booking-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Детали записи</h3>
              <button className="close-btn" onClick={() => setSelectedBooking(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-row">
                <Calendar size={18} />
                <div>
                  <label>Дата и время</label>
                  <span>
                    {new Date(selectedBooking.booking_date).toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })} в {new Date(selectedBooking.booking_date).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
              
              {selectedBooking.service_name && (
                <div className="detail-row">
                  <Clock size={18} />
                  <div>
                    <label>Услуга</label>
                    <span>{selectedBooking.service_name}</span>
                  </div>
                </div>
              )}
              
              {isProvider && (
                <>
                  <div className="detail-row">
                    <User size={18} />
                    <div>
                      <label>Клиент</label>
                      <span>{selectedBooking.client_name}</span>
                    </div>
                  </div>
                  
                  {selectedBooking.client_phone && (
                    <div className="detail-row">
                      <Phone size={18} />
                      <div>
                        <label>Телефон</label>
                        <a href={`tel:${selectedBooking.client_phone}`}>
                          {selectedBooking.client_phone}
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {selectedBooking.client_email && (
                    <div className="detail-row">
                      <Mail size={18} />
                      <div>
                        <label>Email</label>
                        <a href={`mailto:${selectedBooking.client_email}`}>
                          {selectedBooking.client_email}
                        </a>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {selectedBooking.client_notes && (
                <div className="detail-row">
                  <MessageCircle size={18} />
                  <div>
                    <label>Комментарий</label>
                    <span>{selectedBooking.client_notes}</span>
                  </div>
                </div>
              )}
              
              <div className="status-badge-large" style={{
                backgroundColor: STATUS_COLORS[selectedBooking.status]?.bg,
                color: STATUS_COLORS[selectedBooking.status]?.text
              }}>
                {selectedBooking.status === 'PENDING' && 'Ожидает подтверждения'}
                {selectedBooking.status === 'CONFIRMED' && 'Подтверждена'}
                {selectedBooking.status === 'CANCELLED' && 'Отменена'}
                {selectedBooking.status === 'COMPLETED' && 'Завершена'}
                {selectedBooking.status === 'NO_SHOW' && 'Клиент не пришёл'}
              </div>
            </div>
            
            {/* Actions */}
            <div className="modal-actions">
              {selectedBooking.status === 'PENDING' && (
                <>
                  {isProvider && (
                    <button
                      className="confirm-btn"
                      onClick={() => handleUpdateStatus(selectedBooking.id, 'CONFIRMED')}
                      style={{ backgroundColor: moduleColor }}
                    >
                      <Check size={16} /> Подтвердить
                    </button>
                  )}
                  <button
                    className="cancel-btn"
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'CANCELLED')}
                  >
                    <X size={16} /> Отменить
                  </button>
                </>
              )}
              
              {selectedBooking.status === 'CONFIRMED' && isProvider && (
                <>
                  <button
                    className="complete-btn"
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'COMPLETED')}
                    style={{ backgroundColor: moduleColor }}
                  >
                    <Check size={16} /> Завершить
                  </button>
                  <button
                    className="no-show-btn"
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'NO_SHOW')}
                  >
                    Не пришёл
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Booking Modal */}
      {showBookingModal && (
        <div className="modal-overlay" onClick={() => setShowBookingModal(false)}>
          <div className="create-booking-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Запись на услугу</h3>
              <button className="close-btn" onClick={() => setShowBookingModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="selected-time-info">
                <Calendar size={20} style={{ color: moduleColor }} />
                <div>
                  <strong>
                    {new Date(selectedSlot?.start).toLocaleDateString('ru-RU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </strong>
                  <span>
                    {new Date(selectedSlot?.start).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })} - {new Date(selectedSlot?.end).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
              
              <div className="form-group">
                <label>Ваше имя</label>
                <input
                  type="text"
                  value={bookingForm.clientName}
                  onChange={e => setBookingForm({ ...bookingForm, clientName: e.target.value })}
                  placeholder={`${user?.first_name || ''} ${user?.last_name || ''}`}
                />
              </div>
              
              <div className="form-group">
                <label>Телефон</label>
                <input
                  type="tel"
                  value={bookingForm.clientPhone}
                  onChange={e => setBookingForm({ ...bookingForm, clientPhone: e.target.value })}
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
              
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={bookingForm.clientEmail}
                  onChange={e => setBookingForm({ ...bookingForm, clientEmail: e.target.value })}
                  placeholder={user?.email || ''}
                />
              </div>
              
              <div className="form-group">
                <label>Комментарий (необязательно)</label>
                <textarea
                  value={bookingForm.clientNotes}
                  onChange={e => setBookingForm({ ...bookingForm, clientNotes: e.target.value })}
                  placeholder="Дополнительная информация для мастера..."
                  rows={3}
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowBookingModal(false)}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateBooking}
                disabled={submitting}
                style={{ backgroundColor: moduleColor }}
              >
                {submitting ? (
                  <><Loader2 size={16} className="spin" /> Записываем...</>
                ) : (
                  <><Check size={16} /> Записаться</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Availability Settings Modal (Provider only) */}
      {showAvailabilitySettings && (
        <div className="modal-overlay" onClick={() => setShowAvailabilitySettings(false)}>
          <div className="availability-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Settings size={20} /> Настройки расписания</h3>
              <button className="close-btn" onClick={() => setShowAvailabilitySettings(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <p className="settings-description">
                Настройте часы работы для каждого дня недели
              </p>
              
              {Object.entries(availability).map(([day, settings]) => (
                <div key={day} className="day-row">
                  <label className="day-toggle">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={e => setAvailability({
                        ...availability,
                        [day]: { ...settings, enabled: e.target.checked }
                      })}
                    />
                    <span className="day-name">
                      {day === 'monday' && 'Понедельник'}
                      {day === 'tuesday' && 'Вторник'}
                      {day === 'wednesday' && 'Среда'}
                      {day === 'thursday' && 'Четверг'}
                      {day === 'friday' && 'Пятница'}
                      {day === 'saturday' && 'Суббота'}
                      {day === 'sunday' && 'Воскресенье'}
                    </span>
                  </label>
                  
                  {settings.enabled && (
                    <div className="time-inputs">
                      <input
                        type="time"
                        value={settings.open}
                        onChange={e => setAvailability({
                          ...availability,
                          [day]: { ...settings, open: e.target.value }
                        })}
                      />
                      <span>—</span>
                      <input
                        type="time"
                        value={settings.close}
                        onChange={e => setAvailability({
                          ...availability,
                          [day]: { ...settings, close: e.target.value }
                        })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowAvailabilitySettings(false)}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                style={{ backgroundColor: moduleColor }}
                onClick={() => {
                  // TODO: Save availability to backend
                  setShowAvailabilitySettings(false);
                }}
              >
                <Check size={16} /> Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceBookingCalendar;
