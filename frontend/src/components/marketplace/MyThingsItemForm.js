/**
 * MyThingsItemForm Component
 * Form to add or edit an inventory item
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Camera, X, Calendar } from 'lucide-react';
import { toast } from '../../utils/animations';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { value: 'smart_things', label: 'Умные Вещи', icon: '🔌' },
  { value: 'wardrobe', label: 'Мой Гардероб', icon: '👔' },
  { value: 'garage', label: 'Мой Гараж', icon: '🚗' },
  { value: 'home', label: 'Мой Дом', icon: '🏠' },
  { value: 'electronics', label: 'Моя Электроника', icon: '💻' },
  { value: 'collection', label: 'Моя Коллекция', icon: '🎨' }
];

const SMART_PLATFORMS = [
  'Apple HomeKit',
  'Google Home',
  'Amazon Alexa',
  'Samsung SmartThings',
  'Yandex Умный дом',
  'Другое'
];

const MyThingsItemForm = ({
  token,
  moduleColor = '#BE185D',
  editItem = null,
  defaultCategory = null,
  onBack,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: defaultCategory || 'electronics',
    subcategory: '',
    purchase_date: '',
    purchase_price: '',
    purchase_location: '',
    warranty_expires: '',
    warranty_info: '',
    current_value: '',
    images: [],
    brand: '',
    model: '',
    serial_number: '',
    color: '',
    size: '',
    is_smart: false,
    smart_platform: '',
    tags: ''
  });
  
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editItem) {
      setFormData({
        name: editItem.name || '',
        description: editItem.description || '',
        category: editItem.category || 'electronics',
        subcategory: editItem.subcategory || '',
        purchase_date: editItem.purchase_date ? editItem.purchase_date.split('T')[0] : '',
        purchase_price: editItem.purchase_price?.toString() || '',
        purchase_location: editItem.purchase_location || '',
        warranty_expires: editItem.warranty_expires ? editItem.warranty_expires.split('T')[0] : '',
        warranty_info: editItem.warranty_info || '',
        current_value: editItem.current_value?.toString() || '',
        images: editItem.images || [],
        brand: editItem.brand || '',
        model: editItem.model || '',
        serial_number: editItem.serial_number || '',
        color: editItem.color || '',
        size: editItem.size || '',
        is_smart: editItem.is_smart || false,
        smart_platform: editItem.smart_platform || '',
        tags: editItem.tags?.join(', ') || ''
      });
    }
  }, [editItem]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    if (formData.images.length + files.length > 5) {
      toast.warning('Максимум 5 изображений');
      return;
    }
    
    setUploading(true);
    
    for (const file of files) {
      try {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        
        const response = await fetch(`${BACKEND_URL}/api/media/upload?module=marketplace`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formDataUpload
        });
        
        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, data.url]
          }));
        }
      } catch (error) {
        console.error('Error uploading image:', error);
      }
    }
    
    setUploading(false);
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Введите название';
    if (!formData.category) newErrors.category = 'Выберите категорию';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category,
        subcategory: formData.subcategory || null,
        purchase_date: formData.purchase_date ? new Date(formData.purchase_date).toISOString() : null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        purchase_location: formData.purchase_location || null,
        warranty_expires: formData.warranty_expires ? new Date(formData.warranty_expires).toISOString() : null,
        warranty_info: formData.warranty_info || null,
        current_value: formData.current_value ? parseFloat(formData.current_value) : null,
        images: formData.images,
        brand: formData.brand || null,
        model: formData.model || null,
        serial_number: formData.serial_number || null,
        color: formData.color || null,
        size: formData.size || null,
        is_smart: formData.is_smart,
        smart_platform: formData.is_smart ? formData.smart_platform : null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : []
      };
      
      const url = editItem
        ? `${BACKEND_URL}/api/inventory/items/${editItem.id}`
        : `${BACKEND_URL}/api/inventory/items`;
      
      const response = await fetch(url, {
        method: editItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        onSuccess?.(data.item);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Ошибка при сохранении');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = CATEGORIES.find(c => c.value === formData.category);

  return (
    <div className="my-things-item-form">
      <div className="form-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
          Назад
        </button>
        <h1>{editItem ? 'Редактировать' : 'Добавить вещь'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="item-form">
        {/* Images */}
        <div className="form-section">
          <h3>Фотографии</h3>
          <div className="images-grid">
            {formData.images.map((img, idx) => (
              <div key={idx} className="image-item">
                <img src={img} alt="" />
                <button type="button" className="remove-image" onClick={() => removeImage(idx)}>
                  <X size={16} />
                </button>
              </div>
            ))}
            
            {formData.images.length < 5 && (
              <label className="image-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <div className="spinner-small"></div>
                ) : (
                  <>
                    <Camera size={24} />
                    <span>Добавить</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className="form-section">
          <h3>Основная информация</h3>
          
          <div className="form-group">
            <label>Название *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Например: iPhone 14 Pro"
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Категория *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={errors.category ? 'error' : ''}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Бренд</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="Apple, Samsung..."
              />
            </div>
            <div className="form-group">
              <label>Модель</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="Pro Max 256GB"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Дополнительная информация..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Цвет</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                placeholder="Чёрный"
              />
            </div>
            <div className="form-group">
              <label>Размер</label>
              <input
                type="text"
                name="size"
                value={formData.size}
                onChange={handleChange}
                placeholder="M, 42, 256GB..."
              />
            </div>
          </div>

          <div className="form-group">
            <label>Серийный номер</label>
            <input
              type="text"
              name="serial_number"
              value={formData.serial_number}
              onChange={handleChange}
              placeholder="SN123456789"
            />
          </div>
        </div>

        {/* Smart Device */}
        {(formData.category === 'smart_things' || formData.category === 'electronics') && (
          <div className="form-section">
            <h3>Умное устройство</h3>
            
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="is_smart"
                  checked={formData.is_smart}
                  onChange={handleChange}
                />
                <span>Это умное устройство</span>
              </label>
            </div>

            {formData.is_smart && (
              <div className="form-group">
                <label>Платформа</label>
                <select
                  name="smart_platform"
                  value={formData.smart_platform}
                  onChange={handleChange}
                >
                  <option value="">Выберите платформу</option>
                  {SMART_PLATFORMS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Purchase Info */}
        <div className="form-section">
          <h3>Информация о покупке</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Дата покупки</label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Цена покупки (₽)</label>
              <input
                type="number"
                name="purchase_price"
                value={formData.purchase_price}
                onChange={handleChange}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Место покупки</label>
            <input
              type="text"
              name="purchase_location"
              value={formData.purchase_location}
              onChange={handleChange}
              placeholder="Магазин, сайт..."
            />
          </div>

          <div className="form-group">
            <label>Текущая стоимость (₽)</label>
            <input
              type="number"
              name="current_value"
              value={formData.current_value}
              onChange={handleChange}
              placeholder="Оценочная стоимость сейчас"
              min="0"
            />
          </div>
        </div>

        {/* Warranty */}
        <div className="form-section">
          <h3>Гарантия</h3>
          
          <div className="form-group">
            <label>Гарантия действует до</label>
            <input
              type="date"
              name="warranty_expires"
              value={formData.warranty_expires}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Информация о гарантии</label>
            <textarea
              name="warranty_info"
              value={formData.warranty_info}
              onChange={handleChange}
              placeholder="Условия, контакты сервиса..."
              rows={2}
            />
          </div>
        </div>

        {/* Tags */}
        <div className="form-section">
          <h3>Теги</h3>
          <div className="form-group">
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="Теги через запятую: работа, игры, повседневное"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>
            Отмена
          </button>
          <button
            type="submit"
            className="btn-primary"
            style={{ backgroundColor: moduleColor }}
            disabled={loading}
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MyThingsItemForm;
