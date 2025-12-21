import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Calendar, MapPin, Users, Clock, Coins, Share2, Heart, User, 
  CheckCircle, HelpCircle, XCircle, Star, MessageCircle, Image, 
  Send, Camera, QrCode, Bell, BellOff, Twitter, Facebook, Link2, Copy
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const GoodWillEventDetail = ({ 
  eventId, 
  token, 
  moduleColor = '#8B5CF6',
  onBack,
  onWalletClick,
  currentUser
}) => {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  
  // Phase 2 States
  const [activeTab, setActiveTab] = useState('about');
  const [reviews, setReviews] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [newMessage, setNewMessage] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [hasReminder, setHasReminder] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchEvent();
    if (token) fetchWallet();
  }, [eventId, token]);

  useEffect(() => {
    if (activeTab === 'reviews') fetchReviews();
    if (activeTab === 'photos') fetchPhotos();
    if (activeTab === 'chat') fetchChat();
  }, [activeTab, eventId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchEvent = async () => {
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/finance/wallet`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWallet(data.wallet);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchPhotos = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/photos`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  const fetchChat = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/chat`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  };

  const handleRSVP = async (status) => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchEvent();
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
    }
  };

  const handlePurchaseTicket = async () => {
    if (!selectedTicket || !token) return;
    setProcessing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/purchase-ticket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_id: eventId,
          ticket_type_id: selectedTicket.id,
          pay_with_altyn: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReceipt(data.receipt);
        fetchEvent();
        fetchWallet();
      } else {
        const error = await res.json();
        alert(error.detail || 'Ошибка при покупке билета');
      }
    } catch (error) {
      console.error('Error purchasing ticket:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!token || !newReview.comment.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/reviews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newReview)
      });
      if (res.ok) {
        setNewReview({ rating: 5, comment: '' });
        fetchReviews();
        fetchEvent();
      } else {
        const error = await res.json();
        alert(error.detail || 'Ошибка при отправке отзыва');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!token || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: newMessage })
      });
      if (res.ok) {
        setNewMessage('');
        fetchChat();
      } else {
        const error = await res.json();
        alert(error.detail || 'Ошибка при отправке сообщения');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploadingPhoto(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('source_module', 'community');
      uploadData.append('privacy_level', 'PUBLIC');
      
      const uploadRes = await fetch(`${BACKEND_URL}/api/media/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: uploadData
      });
      
      if (uploadRes.ok) {
        const uploadResult = await uploadRes.json();
        const imageUrl = `${BACKEND_URL}${uploadResult.file_url}`;
        
        const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/photos`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ image_url: imageUrl })
        });
        
        if (res.ok) {
          fetchPhotos();
        }
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleShare = async (platform) => {
    const shareUrl = `${window.location.origin}/goodwill/event/${eventId}`;
    const shareText = `Приглашаю на мероприятие: ${event?.title}`;
    
    try {
      await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ platform })
      });
    } catch (error) {
      console.error('Error tracking share:', error);
    }
    
    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        alert('Ссылка скопирована!');
        break;
      default:
        break;
    }
    setShowShareModal(false);
  };

  const handleToggleReminder = async () => {
    if (!token) return;
    try {
      if (hasReminder) {
        await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/reminder`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setHasReminder(false);
      } else {
        await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/reminder`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setHasReminder(true);
        alert('Напоминание установлено!');
      }
    } catch (error) {
      console.error('Error toggling reminder:', error);
    }
  };

  const handleShowQRCode = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/goodwill/events/${eventId}/qr-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQrCode(data);
        setShowQRModal(true);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    }
  };

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatChatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const isOrganizer = event?.organizer?.user_id === currentUser?.id;
  const isCoOrganizer = event?.co_organizer_ids?.includes(currentUser?.id);
  const canManageEvent = isOrganizer || isCoOrganizer;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="spinner" style={{ borderTopColor: moduleColor }}></div>
        <p style={{ color: '#64748b', marginTop: '16px' }}>Загрузка...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p>Мероприятие не найдено</p>
      </div>
    );
  }

  const youtubeId = extractYouTubeId(event.youtube_url);

  const tabs = [
    { id: 'about', label: 'О мероприятии', icon: '📋' },
    { id: 'reviews', label: `Отзывы${event.reviews_count ? ` (${event.reviews_count})` : ''}`, icon: '⭐' },
    { id: 'photos', label: `Фото${event.photos_count ? ` (${event.photos_count})` : ''}`, icon: '📷' },
    { id: 'chat', label: 'Чат', icon: '💬' }
  ];

  return (
    <div>
      {/* Back Button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          marginBottom: '20px',
          padding: '8px 0',
          fontSize: '14px'
        }}
      >
        <ArrowLeft size={18} />
        Назад к списку
      </button>

      {/* Cover Image / YouTube Video */}
      <div style={{ 
        height: youtubeId ? 'auto' : '250px', 
        background: !youtubeId && (event.cover_image 
          ? `url(${event.cover_image}) center/cover`
          : `linear-gradient(135deg, ${event.category?.color || moduleColor}60 0%, ${event.category?.color || moduleColor}30 100%)`),
        borderRadius: '20px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {youtubeId ? (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '20px' }}
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="Event video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ) : (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            <span>{event.category?.icon}</span>
            <span style={{ color: event.category?.color }}>{event.category?.name}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowShareModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '500',
            color: '#475569'
          }}
        >
          <Share2 size={16} />
          Поделиться
        </button>
        
        {token && (
          <button
            onClick={handleToggleReminder}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: hasReminder ? moduleColor + '20' : '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '500',
              color: hasReminder ? moduleColor : '#475569'
            }}
          >
            {hasReminder ? <BellOff size={16} /> : <Bell size={16} />}
            {hasReminder ? 'Отключить напоминание' : 'Напомнить'}
          </button>
        )}
        
        {canManageEvent && (
          <button
            onClick={handleShowQRCode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '500',
              color: '#475569'
            }}
          >
            <QrCode size={16} />
            QR для регистрации
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '24px', 
        borderBottom: '2px solid #e2e8f0',
        paddingBottom: '12px',
        overflowX: 'auto'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              background: activeTab === tab.id ? moduleColor : 'transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
        {/* Main Content */}
        <div>
          {activeTab === 'about' && (
            <>
              <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 16px 0' }}>
                {event.title}
              </h1>

              {/* Rating Summary */}
              {event.average_rating > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        size={18}
                        fill={star <= Math.round(event.average_rating) ? '#F59E0B' : 'transparent'}
                        color={star <= Math.round(event.average_rating) ? '#F59E0B' : '#e2e8f0'}
                      />
                    ))}
                  </div>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>{event.average_rating?.toFixed(1)}</span>
                  <span style={{ color: '#64748b' }}>({event.reviews_count} отзывов)</span>
                </div>
              )}

              {/* Organizer */}
              {event.organizer && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  marginBottom: '24px',
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '12px'
                }}>
                  {event.organizer.logo ? (
                    <img 
                      src={event.organizer.logo} 
                      alt="" 
                      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '50%', 
                      background: moduleColor + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      color: moduleColor
                    }}>
                      {event.organizer.name?.[0]}
                    </div>
                  )}
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#1e293b' }}>
                      {event.organizer.name}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Организатор
                    </p>
                  </div>
                </div>
              )}

              {/* Event Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Calendar size={20} color={moduleColor} />
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '500', color: '#1e293b' }}>
                      {formatDate(event.start_date)}
                    </p>
                    {event.end_date && (
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        До: {formatDate(event.end_date)}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <MapPin size={20} color={moduleColor} />
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '500', color: '#1e293b' }}>
                      {event.is_online ? 'Онлайн мероприятие' : event.venue_name || event.city}
                    </p>
                    {event.address && (
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        {event.address}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Users size={20} color={moduleColor} />
                  <p style={{ margin: 0, color: '#1e293b' }}>
                    {event.attendees_count} участников
                    {event.maybe_count > 0 && ` • ${event.maybe_count} возможно`}
                    {event.capacity > 0 && ` / ${event.capacity} мест`}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 12px 0' }}>
                  О мероприятии
                </h3>
                <p style={{ color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {event.description}
                </p>
              </div>

              {/* Attendees Preview */}
              {event.attendees_preview && event.attendees_preview.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b', margin: '0 0 12px 0' }}>
                    Участники
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {event.attendees_preview.map((att, i) => (
                      <div key={i} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderRadius: '20px'
                      }}>
                        {att.user?.profile_picture ? (
                          <img 
                            src={att.user.profile_picture} 
                            alt="" 
                            style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ 
                            width: '24px', 
                            height: '24px', 
                            borderRadius: '50%', 
                            background: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <User size={12} color="#64748b" />
                          </div>
                        )}
                        <span style={{ fontSize: '13px', color: '#475569' }}>
                          {att.user?.first_name} {att.user?.last_name?.[0]}.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: '0 0 20px 0' }}>
                Отзывы о мероприятии
              </h2>

              {/* Add Review Form */}
              {token && (event.my_rsvp === 'GOING' || event.my_attendance) && (
                <form onSubmit={handleSubmitReview} style={{
                  background: '#f8fafc',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '24px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontWeight: '600' }}>Оставить отзыв</h4>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Оценка</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewReview({ ...newReview, rating: star })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                        >
                          <Star
                            size={28}
                            fill={star <= newReview.rating ? '#F59E0B' : 'transparent'}
                            color={star <= newReview.rating ? '#F59E0B' : '#cbd5e1'}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <textarea
                      value={newReview.comment}
                      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      placeholder="Расскажите о своих впечатлениях..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '10px',
                        fontSize: '15px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={submittingReview || !newReview.comment.trim()}
                    style={{
                      padding: '10px 20px',
                      background: submittingReview ? '#94a3b8' : moduleColor,
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '500',
                      cursor: submittingReview ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {submittingReview ? 'Отправка...' : 'Отправить отзыв'}
                  </button>
                </form>
              )}

              {/* Reviews List */}
              {reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <Star size={48} color="#e2e8f0" style={{ marginBottom: '12px' }} />
                  <p>Пока нет отзывов</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {reviews.map(review => (
                    <div key={review.id} style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: '16px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: moduleColor + '20',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: moduleColor,
                            fontWeight: '600'
                          }}>
                            {review.user?.first_name?.[0] || 'U'}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: '500' }}>
                              {review.user?.first_name} {review.user?.last_name}
                            </p>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                  key={star}
                                  size={14}
                                  fill={star <= review.rating ? '#F59E0B' : 'transparent'}
                                  color={star <= review.rating ? '#F59E0B' : '#e2e8f0'}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(review.created_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                  Фотогалерея
                </h2>
                {token && (event.my_rsvp === 'GOING' || event.my_attendance) && (
                  <>
                    <input
                      type="file"
                      ref={photoInputRef}
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 16px',
                        background: moduleColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      <Camera size={16} />
                      {uploadingPhoto ? 'Загрузка...' : 'Добавить фото'}
                    </button>
                  </>
                )}
              </div>

              {photos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <Image size={48} color="#e2e8f0" style={{ marginBottom: '12px' }} />
                  <p>Пока нет фотографий</p>
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                  gap: '12px' 
                }}>
                  {photos.map(photo => (
                    <div key={photo.id} style={{ 
                      borderRadius: '12px', 
                      overflow: 'hidden',
                      aspectRatio: '1',
                      background: '#f1f5f9'
                    }}>
                      <img
                        src={photo.image_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: '0 0 20px 0' }}>
                Чат мероприятия
              </h2>

              {!token ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <MessageCircle size={48} color="#e2e8f0" style={{ marginBottom: '12px' }} />
                  <p>Войдите, чтобы участвовать в чате</p>
                </div>
              ) : !(event.my_rsvp === 'GOING' || event.my_attendance?.status === 'GOING' || canManageEvent) ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <MessageCircle size={48} color="#e2e8f0" style={{ marginBottom: '12px' }} />
                  <p>Чат доступен только для участников мероприятия</p>
                </div>
              ) : (
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '500px'
                }}>
                  {/* Messages */}
                  <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {chatMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <p>Начните общение!</p>
                      </div>
                    ) : (
                      chatMessages.map(msg => (
                        <div key={msg.id} style={{
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'flex-start'
                        }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: moduleColor + '20',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: moduleColor,
                            fontWeight: '600',
                            flexShrink: 0
                          }}>
                            {msg.user?.first_name?.[0] || 'U'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: '600', fontSize: '14px' }}>
                                {msg.user?.first_name} {msg.user?.last_name}
                              </span>
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                {formatChatTime(msg.timestamp)}
                              </span>
                            </div>
                            <p style={{ margin: 0, color: '#475569', fontSize: '14px' }}>{msg.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <form onSubmit={handleSendMessage} style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '16px',
                    background: 'white',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Написать сообщение..."
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '10px',
                        fontSize: '14px'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={sendingMessage || !newMessage.trim()}
                      style={{
                        padding: '12px 20px',
                        background: sendingMessage ? '#94a3b8' : moduleColor,
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: sendingMessage ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            position: 'sticky',
            top: '20px'
          }}>
            {/* Price */}
            {event.is_free ? (
              <div style={{ 
                background: '#ECFDF5', 
                padding: '16px', 
                borderRadius: '12px', 
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#059669' }}>
                  Бесплатно
                </p>
              </div>
            ) : event.ticket_types?.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: '600' }}>Билеты</h4>
                {event.ticket_types.map(ticket => (
                  <div 
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    style={{
                      padding: '12px',
                      border: selectedTicket?.id === ticket.id ? `2px solid ${moduleColor}` : '2px solid #e2e8f0',
                      borderRadius: '10px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      background: selectedTicket?.id === ticket.id ? moduleColor + '10' : 'white'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500' }}>{ticket.name}</span>
                      <span style={{ fontWeight: '700', color: '#F59E0B' }}>
                        {ticket.altyn_price || ticket.price} {ticket.altyn_price ? 'AC' : '₽'}
                      </span>
                    </div>
                    {ticket.quantity > 0 && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Осталось: {ticket.quantity - (ticket.sold || 0)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* RSVP Buttons */}
            {event.my_attendance?.payment_transaction_id ? (
              <div style={{ 
                background: '#ECFDF5', 
                padding: '16px', 
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <CheckCircle size={24} color="#059669" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontWeight: '600', color: '#059669' }}>Билет куплен</p>
              </div>
            ) : event.is_free ? (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button
                    onClick={() => handleRSVP('GOING')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: event.my_rsvp === 'GOING' ? '#10B981' : '#f1f5f9',
                      color: event.my_rsvp === 'GOING' ? 'white' : '#64748b',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle size={16} />
                    Иду
                  </button>
                  <button
                    onClick={() => handleRSVP('MAYBE')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: event.my_rsvp === 'MAYBE' ? '#F59E0B' : '#f1f5f9',
                      color: event.my_rsvp === 'MAYBE' ? 'white' : '#64748b',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <HelpCircle size={16} />
                    Может быть
                  </button>
                </div>
                {event.my_rsvp && event.my_rsvp !== 'NOT_GOING' && (
                  <button
                    onClick={() => handleRSVP('NOT_GOING')}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'transparent',
                      color: '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Отменить участие
                  </button>
                )}
              </div>
            ) : selectedTicket?.altyn_price && (
              <div>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={!wallet || wallet.coin_balance < selectedTicket.altyn_price}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: (!wallet || wallet.coin_balance < selectedTicket.altyn_price) ? '#94a3b8' : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: (!wallet || wallet.coin_balance < selectedTicket.altyn_price) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Coins size={18} />
                  Оплатить ALTYN
                </button>
                {wallet && (
                  <p style={{ 
                    textAlign: 'center', 
                    margin: '12px 0 0 0', 
                    fontSize: '13px',
                    color: wallet.coin_balance >= (selectedTicket?.altyn_price || 0) ? '#059669' : '#EF4444'
                  }}>
                    Ваш баланс: {wallet.coin_balance?.toLocaleString()} AC
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedTicket && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => !receipt && setShowPaymentModal(false)}>
          <div 
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%'
            }}
            onClick={e => e.stopPropagation()}
          >
            {receipt ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <h3 style={{ margin: '0 0 8px 0' }}>Оплата успешна!</h3>
                <p style={{ color: '#64748b', marginBottom: '16px' }}>Билет куплен</p>
                
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', textAlign: 'left', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>КВИТАНЦИЯ</p>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}>Мероприятие: {event.title}</p>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}>Билет: {selectedTicket.name}</p>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}>Сумма: {receipt.total_paid} AC</p>
                  <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748b' }}>№ {receipt.receipt_id?.slice(0, 8).toUpperCase()}</p>
                </div>
                
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setReceipt(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: moduleColor,
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Отлично!
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ margin: '0 0 16px 0' }}>Оплата ALTYN COIN</h3>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>{event.title}</p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Билет: {selectedTicket.name}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                    <span>Сумма:</span>
                    <span style={{ fontWeight: '700', color: '#F59E0B' }}>{selectedTicket.altyn_price} AC</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                    <span>Комиссия (0.1%):</span>
                    <span>{(selectedTicket.altyn_price * 0.001).toFixed(2)} AC</span>
                  </div>
                </div>
                <p style={{ 
                  textAlign: 'center', 
                  margin: '0 0 16px 0',
                  color: wallet?.coin_balance >= selectedTicket.altyn_price ? '#059669' : '#EF4444'
                }}>
                  Ваш баланс: {wallet?.coin_balance?.toLocaleString()} AC
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#f1f5f9',
                      color: '#64748b',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handlePurchaseTicket}
                    disabled={processing || !wallet || wallet.coin_balance < selectedTicket.altyn_price}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: processing ? '#94a3b8' : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '600',
                      cursor: processing ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {processing ? 'Обработка...' : 'Оплатить'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowShareModal(false)}>
          <div 
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '350px',
              width: '90%'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', textAlign: 'center' }}>Поделиться мероприятием</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => handleShare('twitter')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: '#1DA1F2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                <Twitter size={20} />
                Twitter
              </button>
              <button
                onClick={() => handleShare('facebook')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: '#4267B2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                <Facebook size={20} />
                Facebook
              </button>
              <button
                onClick={() => handleShare('copy')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                <Copy size={20} />
                Скопировать ссылку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && qrCode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowQRModal(false)}>
          <div 
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '350px',
              width: '90%',
              textAlign: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>QR-код для регистрации</h3>
            <div style={{
              background: '#f8fafc',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              {qrCode.qr_image ? (
                <img 
                  src={qrCode.qr_image} 
                  alt="QR Code" 
                  style={{ width: '200px', height: '200px', marginBottom: '12px' }}
                />
              ) : (
                <QrCode size={120} color={moduleColor} style={{ marginBottom: '12px' }} />
              )}
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                Код мероприятия: <strong>{qrCode.checkin_code}</strong>
              </p>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Покажите этот QR-код участникам для отметки на входе
            </p>
            <button
              onClick={() => setShowQRModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: moduleColor,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoodWillEventDetail;
