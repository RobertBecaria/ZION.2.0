import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Calendar, MapPin, Clock, Coins, Plus, X, Globe, Image, Youtube, Users, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const GoodWillEventForm = ({ 
  token, 
  moduleColor = '#8B5CF6',
  onBack,
  onEventCreated 
}) => {
  const [categories, setCategories] = useState([]);
  const [organizerProfile, setOrganizerProfile] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    group_id: '',
    cover_image: '',
    youtube_url: '',
    city: '',
    address: '',
    venue_name: '',
    latitude: null,
    longitude: null,
    is_online: false,
    online_link: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    visibility: 'PUBLIC',
    capacity: 0,
    enable_waitlist: true,
    is_free: true,
    ticket_types: [],
    is_recurring: false,
    recurrence_pattern: '',
    co_organizer_ids: []
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      // Fetch categories
      const catRes = await fetch(`${BACKEND_URL}/api/goodwill/categories`);
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data.categories || []);
      }

      // Fetch organizer profile
      const profileRes = await fetch(`${BACKEND_URL}/api/goodwill/organizer-profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const data = await profileRes.json();
        setOrganizerProfile(data.profile);
      }

      // Fetch my groups
      const groupsRes = await fetch(`${BACKEND_URL}/api/goodwill/my-groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setMyGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTicketType = () => {
    setFormData({
      ...formData,
      ticket_types: [
        ...formData.ticket_types,
        { id: Date.now().toString(), name: '', price: 0, altyn_price: 0, quantity: 0 }
      ]
    });
  };

  const updateTicketType = (index, field, value) => {
    const updated = [...formData.ticket_types];
    updated[index][field] = value;
    setFormData({ ...formData, ticket_types: updated });
  };

  const removeTicketType = (index) => {
    setFormData({
      ...formData,
      ticket_types: formData.ticket_types.filter((_, i) => i !== index)
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('source_module', 'community');
      uploadData.append('privacy_level', 'PUBLIC');
      
      const res = await fetch(`${BACKEND_URL}/api/media/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: uploadData
      });
      
      if (res.ok) {
        const data = await res.json();
        setFormData({ ...formData, cover_image: `${BACKEND_URL}${data.file_url}` });
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const extractYouTubeId = (url) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!organizerProfile) {
      alert('Сначала создайте профиль организатора');
      return;
    }

    setSubmitting(true);
    try {
      // Build start_date datetime
      const startDateTime = new Date(`${formData.start_date}T${formData.start_time || '12:00'}`);
      let endDateTime = null;
      if (formData.end_date) {
        endDateTime = new Date(`${formData.end_date}T${formData.end_time || '18:00'}`);
      }

      const payload = {
        organizer_profile_id: organizerProfile.id,
        title: formData.title,
        description: formData.description,
        category_id: formData.category_id,
        group_id: formData.group_id || null,
        cover_image: formData.cover_image || null,
        youtube_url: formData.youtube_url || null,
        city: formData.city,
        address: formData.address || null,
        venue_name: formData.venue_name || null,
        is_online: formData.is_online,
        online_link: formData.is_online ? formData.online_link : null,
        start_date: startDateTime.toISOString(),
        end_date: endDateTime?.toISOString() || null,
        visibility: formData.visibility,
        capacity: parseInt(formData.capacity) || 0,
        enable_waitlist: formData.enable_waitlist,
        is_free: formData.is_free,
        ticket_types: !formData.is_free ? formData.ticket_types.map(t => ({
          name: t.name,
          price: parseFloat(t.price) || 0,
          altyn_price: parseFloat(t.altyn_price) || null,
          quantity: parseInt(t.quantity) || 0
        })) : [],
        tags: []
      };

      const res = await fetch(`${BACKEND_URL}/api/goodwill/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        onEventCreated?.(data.event);
      } else {
        const error = await res.json();
        alert(error.detail || 'Ошибка при создании мероприятия');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка при создании мероприятия');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div className="spinner" style={{ borderTopColor: moduleColor }}></div>
        <p style={{ color: '#64748b', marginTop: '16px' }}>Загрузка...</p>
      </div>
    );
  }

  if (!organizerProfile) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
        <h3 style={{ margin: '0 0 8px 0' }}>Нужен профиль организатора</h3>
        <p style={{ color: '#64748b', marginBottom: '20px' }}>
          Чтобы создавать мероприятия, сначала создайте профиль организатора
        </p>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            background: moduleColor,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Создать профиль
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
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
          padding: '8px 0'
        }}
      >
        <ArrowLeft size={18} />
        Назад
      </button>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
          ✨ Создать мероприятие
        </h2>
        <p style={{ color: '#64748b', margin: 0 }}>
          Заполните информацию о вашем событии
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>📋 Основная информация</h4>

          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Название *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Название мероприятия"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '15px'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Описание *</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Расскажите о мероприятии..."
              rows={4}
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

          {/* Category */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Категория *</label>
            <select
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '15px',
                background: 'white'
              }}
            >
              <option value="">Выберите категорию</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {/* Group */}
          {myGroups.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Группа (опционально)</label>
              <select
                value={formData.group_id}
                onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '15px',
                  background: 'white'
                }}
              >
                <option value="">Без группы</option>
                {myGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Media */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>🖼️ Медиа</h4>

          {/* Cover Image Upload */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              <Image size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Обложка мероприятия
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            {formData.cover_image ? (
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                <img
                  src={formData.cover_image}
                  alt="Обложка"
                  style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px' }}
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, cover_image: '' })}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                style={{
                  width: '100%',
                  padding: '40px 20px',
                  background: '#f8fafc',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  cursor: uploadingImage ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#64748b'
                }}
              >
                {uploadingImage ? (
                  <>
                    <div className="spinner" style={{ borderTopColor: moduleColor, width: '24px', height: '24px' }}></div>
                    <span>Загрузка...</span>
                  </>
                ) : (
                  <>
                    <Image size={32} color={moduleColor} />
                    <span>Нажмите для загрузки обложки</span>
                    <span style={{ fontSize: '12px' }}>JPG, PNG до 5MB</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* YouTube URL */}
          <div style={{ marginBottom: '0' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              <Youtube size={16} style={{ marginRight: '6px', verticalAlign: 'middle', color: '#FF0000' }} />
              YouTube видео (опционально)
            </label>
            <input
              type="url"
              value={formData.youtube_url}
              onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '15px'
              }}
            />
            {formData.youtube_url && extractYouTubeId(formData.youtube_url) && (
              <div style={{ marginTop: '12px', borderRadius: '12px', overflow: 'hidden' }}>
                <iframe
                  width="100%"
                  height="200"
                  src={`https://www.youtube.com/embed/${extractYouTubeId(formData.youtube_url)}`}
                  title="YouTube preview"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ borderRadius: '12px' }}
                ></iframe>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>📍 Место проведения</h4>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_online}
                onChange={(e) => setFormData({ ...formData, is_online: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: moduleColor }}
              />
              <Globe size={18} />
              Онлайн мероприятие
            </label>
          </div>

          {formData.is_online ? (
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Ссылка на трансляцию</label>
              <input
                type="url"
                value={formData.online_link}
                onChange={(e) => setFormData({ ...formData, online_link: e.target.value })}
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '15px'
                }}
              />
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Город *</label>
                  <input
                    type="text"
                    required={!formData.is_online}
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Москва"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '15px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Название места</label>
                  <input
                    type="text"
                    value={formData.venue_name}
                    onChange={(e) => setFormData({ ...formData, venue_name: e.target.value })}
                    placeholder="Парк Горького"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '15px'
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Адрес</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Улица, дом"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '15px'
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Date & Time */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>🗓 Дата и время</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Дата начала *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '15px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Время начала *</label>
              <input
                type="time"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '15px'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Дата окончания</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '15px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Время окончания</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '15px'
                }}
              />
            </div>
          </div>
        </div>

        {/* Settings */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>⚙️ Настройки</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Видимость</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '15px',
                  background: 'white'
                }}
              >
                <option value="PUBLIC">🌍 Публичное</option>
                <option value="PRIVATE">🔒 По приглашению</option>
                <option value="GROUP_ONLY">👥 Только для группы</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Вместимость (0 = без ограничений)</label>
              <input
                type="number"
                min="0"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '15px'
                }}
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.enable_waitlist}
              onChange={(e) => setFormData({ ...formData, enable_waitlist: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: moduleColor }}
            />
            Включить лист ожидания
          </label>
        </div>

        {/* Tickets */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>🎫 Билеты</h4>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.is_free}
                onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: moduleColor }}
              />
              Бесплатное мероприятие
            </label>
          </div>

          {!formData.is_free && (
            <div>
              {formData.ticket_types.map((ticket, index) => (
                <div key={ticket.id} style={{
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '500' }}>Билет #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTicketType(index)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#64748b' }}>Название</label>
                      <input
                        type="text"
                        value={ticket.name}
                        onChange={(e) => updateTicketType(index, 'name', e.target.value)}
                        placeholder="Стандарт"
                        style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#64748b' }}>Цена (₽)</label>
                      <input
                        type="number"
                        min="0"
                        value={ticket.price}
                        onChange={(e) => updateTicketType(index, 'price', e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#F59E0B' }}>Цена (AC)</label>
                      <input
                        type="number"
                        min="0"
                        value={ticket.altyn_price}
                        onChange={(e) => updateTicketType(index, 'altyn_price', e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #F59E0B', borderRadius: '8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#64748b' }}>Кол-во</label>
                      <input
                        type="number"
                        min="0"
                        value={ticket.quantity}
                        onChange={(e) => updateTicketType(index, 'quantity', e.target.value)}
                        placeholder="0 = ∞"
                        style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addTicketType}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  background: '#f1f5f9',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '10px',
                  color: '#64748b',
                  cursor: 'pointer',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                <Plus size={16} />
                Добавить тип билета
              </button>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '16px',
            background: submitting ? '#94a3b8' : moduleColor,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? 'Создание...' : '✨ Создать мероприятие'}
        </button>
      </form>
    </div>
  );
};

export default GoodWillEventForm;
