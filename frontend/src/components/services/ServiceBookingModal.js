/**
 * ServiceBookingModal Component
 * Modal for booking appointments with calendar view
 */
import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const ServiceBookingModal = ({
  listing,
  onClose,
  onSuccess,
  moduleColor = '#B91C1C',
  user
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState(1); // 1: select date, 2: select time, 3: confirm
  const [bookingData, setBookingData] = useState({
    client_name: user ? `${user.first_name} ${user.last_name}` : '',
    client_phone: user?.phone || '',
    client_email: user?.email || '',
    client_notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    // Previous month days
    for (let i = 0; i < startingDay; i++) {
      const prevDate = new Date(year, month, -startingDay + i + 1);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Next month days to fill the grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  // Check if date is in the past
  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Check if date is too far in future
  const isTooFarFuture = (date) => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (listing?.booking_advance_days || 30));
    return date > maxDate;
  };

  // Fetch available slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedDate]);

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !listing?.id) return;
    
    setLoadingSlots(true);
    setAvailableSlots([]);
    setSelectedSlot(null);
    
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await fetch(
        `${BACKEND_URL}/api/services/bookings/available-slots/${listing.id}?date=${dateStr}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAvailableSlots(data.slots || []);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateSelect = (day) => {
    if (!day.isCurrentMonth || isPastDate(day.date) || isTooFarFuture(day.date)) return;
    setSelectedDate(day.date);
    setStep(2);
  };

  const handleSlotSelect = (slot) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !bookingData.client_name) return;
    
    setSubmitting(true);
    setError('');
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/services/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service_id: listing.id,
          booking_date: selectedSlot.start,
          client_name: bookingData.client_name,
          client_phone: bookingData.client_phone,
          client_email: bookingData.client_email,
          client_notes: bookingData.client_notes
        })
      });
      
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess && onSuccess();
          onClose();
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.detail || 'Ошибка при создании записи');
      }
    } catch (error) {
      console.error('Booking error:', error);
      setError('Ошибка сети. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    return date?.toLocaleDateString('ru-RU', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  if (success) {
    return (
      <div className="booking-modal-overlay" onClick={onClose}>
        <div className="booking-modal success-modal" onClick={e => e.stopPropagation()}>
          <div className="success-content">
            <div className="success-icon" style={{ backgroundColor: `${moduleColor}15` }}>
              <Check size={48} color={moduleColor} />
            </div>
            <h2>Запись создана!</h2>
            <p>Вы успешно записались на {formatDate(selectedDate)}</p>
            <p className="time-slot">{formatTime(selectedSlot?.start)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-modal-overlay" onClick={onClose}>
      <div className="booking-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="booking-modal-header" style={{ borderBottomColor: `${moduleColor}30` }}>
          <div>
            <h2>Записаться онлайн</h2>
            <p className="service-name">{listing?.name}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="booking-steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`} style={{ '--step-color': moduleColor }}>
            <span className="step-number">1</span>
            <span className="step-label">Дата</span>
          </div>
          <div className="step-line" style={{ backgroundColor: step >= 2 ? moduleColor : '#e5e7eb' }}></div>
          <div className={`step ${step >= 2 ? 'active' : ''}`} style={{ '--step-color': moduleColor }}>
            <span className="step-number">2</span>
            <span className="step-label">Время</span>
          </div>
          <div className="step-line" style={{ backgroundColor: step >= 3 ? moduleColor : '#e5e7eb' }}></div>
          <div className={`step ${step >= 3 ? 'active' : ''}`} style={{ '--step-color': moduleColor }}>
            <span className="step-number">3</span>
            <span className="step-label">Подтверждение</span>
          </div>
        </div>

        {/* Step 1: Date Selection */}
        {step === 1 && (
          <div className="booking-step-content">
            <div className="calendar-header">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>
                <ChevronLeft size={20} />
              </button>
              <h3>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>
                <ChevronRight size={20} />
              </button>
            </div>
            
            <div className="calendar-grid">
              {DAYS_SHORT.map(day => (
                <div key={day} className="calendar-day-header">{day}</div>
              ))}
              {getCalendarDays().map((day, idx) => {
                const isDisabled = !day.isCurrentMonth || isPastDate(day.date) || isTooFarFuture(day.date);
                const isSelected = selectedDate?.toDateString() === day.date.toDateString();
                const isToday = new Date().toDateString() === day.date.toDateString();
                
                return (
                  <div
                    key={idx}
                    className={`calendar-day ${isDisabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => !isDisabled && handleDateSelect(day)}
                    style={{
                      backgroundColor: isSelected ? moduleColor : undefined,
                      borderColor: isToday && !isSelected ? moduleColor : undefined
                    }}
                  >
                    {day.date.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Time Selection */}
        {step === 2 && (
          <div className="booking-step-content">
            <button className="back-step-btn" onClick={() => setStep(1)}>
              <ChevronLeft size={18} /> Назад к календарю
            </button>
            
            <div className="selected-date-display">
              <Calendar size={20} style={{ color: moduleColor }} />
              <span>{formatDate(selectedDate)}</span>
            </div>
            
            {loadingSlots ? (
              <div className="slots-loading">
                <Loader2 size={24} className="spin" style={{ color: moduleColor }} />
                <p>Загрузка доступного времени...</p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="no-slots">
                <Clock size={32} style={{ color: '#9ca3af' }} />
                <p>Нет доступного времени на эту дату</p>
                <button onClick={() => setStep(1)} style={{ color: moduleColor }}>Выбрать другую дату</button>
              </div>
            ) : (
              <div className="time-slots-grid">
                {availableSlots.map((slot, idx) => (
                  <button
                    key={idx}
                    className={`time-slot ${!slot.available ? 'unavailable' : ''} ${selectedSlot === slot ? 'selected' : ''}`}
                    onClick={() => handleSlotSelect(slot)}
                    disabled={!slot.available}
                    style={{
                      borderColor: selectedSlot === slot ? moduleColor : undefined,
                      backgroundColor: selectedSlot === slot ? `${moduleColor}15` : undefined
                    }}
                  >
                    <Clock size={14} />
                    {formatTime(slot.start)}
                    {!slot.available && <span className="unavailable-label">Занято</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="booking-step-content">
            <button className="back-step-btn" onClick={() => setStep(2)}>
              <ChevronLeft size={18} /> Назад к выбору времени
            </button>
            
            <div className="booking-summary">
              <h4>Детали записи</h4>
              <div className="summary-row">
                <Calendar size={18} />
                <span>{formatDate(selectedDate)}</span>
              </div>
              <div className="summary-row">
                <Clock size={18} />
                <span>{formatTime(selectedSlot?.start)} - {formatTime(selectedSlot?.end)}</span>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="booking-form">
              <div className="form-group">
                <label>Ваше имя *</label>
                <input
                  type="text"
                  value={bookingData.client_name}
                  onChange={e => setBookingData({...bookingData, client_name: e.target.value})}
                  required
                  placeholder="Иван Иванов"
                />
              </div>
              
              <div className="form-group">
                <label>Телефон</label>
                <input
                  type="tel"
                  value={bookingData.client_phone}
                  onChange={e => setBookingData({...bookingData, client_phone: e.target.value})}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
              
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={bookingData.client_email}
                  onChange={e => setBookingData({...bookingData, client_email: e.target.value})}
                  placeholder="email@example.com"
                />
              </div>
              
              <div className="form-group">
                <label>Комментарий</label>
                <textarea
                  value={bookingData.client_notes}
                  onChange={e => setBookingData({...bookingData, client_notes: e.target.value})}
                  placeholder="Дополнительная информация..."
                  rows={3}
                />
              </div>
              
              {error && <div className="booking-error">{error}</div>}
              
              <button
                type="submit"
                className="submit-booking-btn"
                disabled={submitting}
                style={{ backgroundColor: moduleColor }}
              >
                {submitting ? (
                  <><Loader2 size={18} className="spin" /> Создание записи...</>
                ) : (
                  <><Check size={18} /> Подтвердить запись</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceBookingModal;
