/**
 * ServiceListingForm Component
 * Form for creating/editing service listings
 */
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Save, Building2, Clock, DollarSign, MapPin,
  Phone, Mail, Globe, Image, Tag, Loader2, Plus, X
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Понедельник' },
  { key: 'tuesday', label: 'Вторник' },
  { key: 'wednesday', label: 'Среда' },
  { key: 'thursday', label: 'Четверг' },
  { key: 'friday', label: 'Пятница' },
  { key: 'saturday', label: 'Суббота' },
  { key: 'sunday', label: 'Воскресенье' }
];

const PRICE_TYPES = [
  { value: 'fixed', label: 'Фиксированная' },
  { value: 'from', label: 'От (минимум)' },
  { value: 'range', label: 'Диапазон' },
  { value: 'negotiable', label: 'По договорённости' }
];

const ServiceListingForm = ({
  listing = null,
  organizations = [],
  onSuccess,
  onCancel,
  moduleColor = '#B91C1C'
}) => {
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');
  
  const [formData, setFormData] = useState({
    organization_id: listing?.organization_id || (organizations[0]?.id || ''),
    name: listing?.name || '',
    description: listing?.description || '',
    short_description: listing?.short_description || '',
    category_id: listing?.category_id || '',
    subcategory_id: listing?.subcategory_id || '',
    price_type: listing?.price_type || 'fixed',
    price_from: listing?.price_from || '',
    price_to: listing?.price_to || '',
    address: listing?.address || '',
    city: listing?.city || '',
    phone: listing?.phone || '',
    email: listing?.email || '',
    website: listing?.website || '',
    accepts_online_booking: listing?.accepts_online_booking ?? true,
    booking_duration_minutes: listing?.booking_duration_minutes || 60,
    working_hours: listing?.working_hours || {},
    tags: listing?.tags || [],
    images: listing?.images || [],
    accept_altyn: listing?.accept_altyn || false,
    altyn_price: listing?.altyn_price || ''
  });

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/services/categories`);
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || {});
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Reset subcategory when category changes
    if (field === 'category_id') {
      setFormData(prev => ({ ...prev, subcategory_id: '' }));
    }
  };

  const handleWorkingHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: {
          ...prev.working_hours[day],
          [field]: value
        }
      }
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim().toLowerCase()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('zion_token');
      const url = listing 
        ? `${BACKEND_URL}/api/services/listings/${listing.id}`
        : `${BACKEND_URL}/api/services/listings`;
      
      const method = listing ? 'PUT' : 'POST';
      
      // Prepare data
      const submitData = {
        ...formData,
        price_from: formData.price_from ? parseFloat(formData.price_from) : null,
        price_to: formData.price_to ? parseFloat(formData.price_to) : null
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });
      
      if (response.ok) {
        onSuccess && onSuccess();
      } else {
        const data = await response.json();
        setError(data.detail || 'Ошибка при сохранении');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Ошибка сети. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories[formData.category_id];

  return (
    <div className="service-listing-form">
      <div className="form-header">
        <button className="back-btn" onClick={onCancel}>
          <ArrowLeft size={20} />
          Назад
        </button>
        <h2>{listing ? 'Редактирование услуги' : 'Новая услуга'}</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Organization Selection */}
        <div className="form-section">
          <h3><Building2 size={18} /> Организация</h3>
          <select
            value={formData.organization_id}
            onChange={e => handleChange('organization_id', e.target.value)}
            required
          >
            <option value="">Выберите организацию</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>

        {/* Basic Info */}
        <div className="form-section">
          <h3>📝 Основная информация</h3>
          
          <div className="form-group">
            <label>Название услуги *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="Например: Стрижка и укладка"
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Категория *</label>
              <select
                value={formData.category_id}
                onChange={e => handleChange('category_id', e.target.value)}
                required
              >
                <option value="">Выберите категорию</option>
                {Object.entries(categories).map(([id, cat]) => (
                  <option key={id} value={id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Подкатегория *</label>
              <select
                value={formData.subcategory_id}
                onChange={e => handleChange('subcategory_id', e.target.value)}
                required
                disabled={!formData.category_id}
              >
                <option value="">Выберите подкатегорию</option>
                {selectedCategory?.subcategories?.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Краткое описание</label>
            <input
              type="text"
              value={formData.short_description}
              onChange={e => handleChange('short_description', e.target.value)}
              placeholder="Краткое описание для карточки (до 100 символов)"
              maxLength={100}
            />
          </div>
          
          <div className="form-group">
            <label>Полное описание *</label>
            <textarea
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="Подробное описание услуги..."
              rows={5}
              required
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="form-section">
          <h3><DollarSign size={18} /> Цена</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Тип цены</label>
              <select
                value={formData.price_type}
                onChange={e => handleChange('price_type', e.target.value)}
              >
                {PRICE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            
            {formData.price_type !== 'negotiable' && (
              <>
                <div className="form-group">
                  <label>{formData.price_type === 'range' ? 'Цена от' : 'Цена'} (₽)</label>
                  <input
                    type="number"
                    value={formData.price_from}
                    onChange={e => handleChange('price_from', e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
                
                {formData.price_type === 'range' && (
                  <div className="form-group">
                    <label>Цена до (₽)</label>
                    <input
                      type="number"
                      value={formData.price_to}
                      onChange={e => handleChange('price_to', e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Location & Contact */}
        <div className="form-section">
          <h3><MapPin size={18} /> Контакты и адрес</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Город</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => handleChange('city', e.target.value)}
                placeholder="Москва"
              />
            </div>
            
            <div className="form-group">
              <label>Адрес</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => handleChange('address', e.target.value)}
                placeholder="ул. Примерная, д. 1"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label><Phone size={14} /> Телефон</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
            
            <div className="form-group">
              <label><Mail size={14} /> Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="contact@example.com"
              />
            </div>
            
            <div className="form-group">
              <label><Globe size={14} /> Веб-сайт</label>
              <input
                type="url"
                value={formData.website}
                onChange={e => handleChange('website', e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        {/* Booking Settings */}
        <div className="form-section">
          <h3><Clock size={18} /> Настройки записи</h3>
          
          <div className="form-row">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.accepts_online_booking}
                  onChange={e => handleChange('accepts_online_booking', e.target.checked)}
                />
                Онлайн запись
              </label>
            </div>
            
            {formData.accepts_online_booking && (
              <div className="form-group">
                <label>Длительность приёма (мин)</label>
                <select
                  value={formData.booking_duration_minutes}
                  onChange={e => handleChange('booking_duration_minutes', parseInt(e.target.value))}
                >
                  <option value={15}>15 минут</option>
                  <option value={30}>30 минут</option>
                  <option value={45}>45 минут</option>
                  <option value={60}>1 час</option>
                  <option value={90}>1.5 часа</option>
                  <option value={120}>2 часа</option>
                </select>
              </div>
            )}
          </div>
          
          {/* Working Hours */}
          <div className="working-hours-editor">
            <label>Часы работы</label>
            {DAYS_OF_WEEK.map(day => (
              <div key={day.key} className="day-hours-row">
                <span className="day-label">{day.label}</span>
                <input
                  type="time"
                  value={formData.working_hours[day.key]?.open || '09:00'}
                  onChange={e => handleWorkingHoursChange(day.key, 'open', e.target.value)}
                />
                <span>-</span>
                <input
                  type="time"
                  value={formData.working_hours[day.key]?.close || '18:00'}
                  onChange={e => handleWorkingHoursChange(day.key, 'close', e.target.value)}
                />
                <label className="closed-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.working_hours[day.key]?.closed || false}
                    onChange={e => handleWorkingHoursChange(day.key, 'closed', e.target.checked)}
                  />
                  Выходной
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="form-section">
          <h3><Tag size={18} /> Теги</h3>
          <div className="tags-input">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              placeholder="Добавить тег..."
            />
            <button type="button" onClick={handleAddTag}>
              <Plus size={18} />
            </button>
          </div>
          <div className="tags-list">
            {formData.tags.map(tag => (
              <span key={tag} className="tag" style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}>
                {tag}
                <button type="button" onClick={() => handleRemoveTag(tag)}>
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        {/* Submit */}
        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
            style={{ backgroundColor: moduleColor }}
          >
            {loading ? (
              <><Loader2 size={18} className="spin" /> Сохранение...</>
            ) : (
              <><Save size={18} /> {listing ? 'Сохранить изменения' : 'Создать услугу'}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ServiceListingForm;
