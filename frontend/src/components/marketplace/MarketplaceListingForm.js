/**
 * MarketplaceListingForm Component
 * Form to create or edit a marketplace listing
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, X, Plus, Camera, Bot, Check, Copy, Sparkles } from 'lucide-react';
import ERICAnalyzeButton from './eric/ERICAnalyzeButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MarketplaceListingForm = ({
  user,
  token,
  moduleColor = '#BE185D',
  editProduct = null,
  onBack,
  onSuccess
}) => {
  const [categories, setCategories] = useState({});
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    subcategory: '',
    price: '',
    altyn_price: '',  // ALTYN COIN price
    accept_altyn: false,  // Accept ALTYN payment
    negotiable: false,
    condition: 'good',
    city: user?.city || '',
    address: '',
    contact_phone: user?.phone || '',
    contact_method: 'message',
    images: [],
    tags: '',
    organization_id: ''
  });
  
  const [errors, setErrors] = useState({});
  const [ericAnalysis, setEricAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisCopied, setAnalysisCopied] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]); // Keep track of File objects for ERIC

  useEffect(() => {
    // Fetch categories
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/marketplace/categories`);
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || {});
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    
    // Fetch user's organizations
    const fetchOrganizations = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/organizations/my`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      }
    };
    
    fetchCategories();
    fetchOrganizations();
  }, [token]);

  useEffect(() => {
    if (editProduct) {
      setFormData({
        title: editProduct.title || '',
        description: editProduct.description || '',
        category: editProduct.category || '',
        subcategory: editProduct.subcategory || '',
        price: editProduct.price?.toString() || '',
        altyn_price: editProduct.altyn_price?.toString() || '',
        accept_altyn: editProduct.accept_altyn || false,
        negotiable: editProduct.negotiable || false,
        condition: editProduct.condition || 'good',
        city: editProduct.city || '',
        address: editProduct.address || '',
        contact_phone: editProduct.contact_phone || '',
        contact_method: editProduct.contact_method || 'message',
        images: editProduct.images || [],
        tags: editProduct.tags?.join(', ') || '',
        organization_id: editProduct.organization_id || ''
      });
    }
  }, [editProduct]);

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
    
    if (formData.images.length + files.length > 10) {
      alert('Максимум 10 изображений');
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
          // Store the File object for ERIC analysis
          setUploadedFiles(prev => [...prev, file]);
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
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalysisComplete = (result) => {
    setEricAnalysis(result);
    setShowAnalysisModal(true);
  };

  const handleAnalysisError = (err) => {
    alert(err);
  };

  const copyAnalysis = () => {
    if (ericAnalysis?.analysis) {
      navigator.clipboard.writeText(ericAnalysis.analysis);
      setAnalysisCopied(true);
      setTimeout(() => setAnalysisCopied(false), 2000);
    }
  };

  const addAnalysisToDescription = () => {
    if (ericAnalysis?.analysis) {
      setFormData(prev => ({
        ...prev,
        description: prev.description 
          ? `${prev.description}\n\n📊 Рекомендации ERIC:\n${ericAnalysis.analysis}` 
          : `📊 Рекомендации ERIC:\n${ericAnalysis.analysis}`
      }));
      setShowAnalysisModal(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) newErrors.title = 'Введите название';
    if (!formData.description.trim()) newErrors.description = 'Введите описание';
    if (!formData.category) newErrors.category = 'Выберите категорию';
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = 'Укажите цену';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        subcategory: formData.subcategory || null,
        price: parseFloat(formData.price),
        altyn_price: formData.altyn_price ? parseFloat(formData.altyn_price) : null,
        accept_altyn: formData.accept_altyn,
        negotiable: formData.negotiable,
        condition: formData.condition,
        city: formData.city || null,
        address: formData.address || null,
        contact_phone: formData.contact_phone || null,
        contact_method: formData.contact_method,
        images: formData.images,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [],
        organization_id: formData.organization_id || null
      };
      
      const url = editProduct 
        ? `${BACKEND_URL}/api/marketplace/products/${editProduct.id}`
        : `${BACKEND_URL}/api/marketplace/products`;
      
      const response = await fetch(url, {
        method: editProduct ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        onSuccess?.(data.product);
      } else {
        const error = await response.json();
        alert(error.detail || 'Ошибка при сохранении');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryData = categories[formData.category];

  return (
    <div className="marketplace-listing-form">
      <div className="form-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
          Назад
        </button>
        <h1>{editProduct ? 'Редактировать объявление' : 'Новое объявление'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="listing-form">
        {/* Images */}
        <div className="form-section">
          <h3>Фотографии</h3>
          <div className="images-grid">
            {formData.images.map((img, idx) => (
              <div key={idx} className="image-item" style={{ position: 'relative' }}>
                <img src={img} alt="" />
                <button type="button" className="remove-image" onClick={() => removeImage(idx)}>
                  <X size={16} />
                </button>
                {/* ERIC Analyze Button for product images */}
                {uploadedFiles[idx] && (
                  <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                    <ERICAnalyzeButton
                      file={uploadedFiles[idx]}
                      context="marketplace"
                      contextData={{ 
                        productTitle: formData.title,
                        category: formData.category 
                      }}
                      onAnalysisComplete={handleAnalysisComplete}
                      onError={handleAnalysisError}
                      variant="icon-only"
                    />
                  </div>
                )}
              </div>
            ))}
            
            {formData.images.length < 10 && (
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
                    <span>Добавить фото</span>
                  </>
                )}
              </label>
            )}
          </div>
          <p className="hint">До 10 фотографий. Первая будет главной. Нажмите ✨ для анализа товара с ERIC.</p>
        </div>

        {/* Basic Info */}
        <div className="form-section">
          <h3>Основная информация</h3>
          
          <div className="form-group">
            <label>Название *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Например: iPhone 14 Pro 256GB"
              className={errors.title ? 'error' : ''}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Категория *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={errors.category ? 'error' : ''}
              >
                <option value="">Выберите категорию</option>
                {Object.entries(categories).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.icon} {cat.name}</option>
                ))}
              </select>
              {errors.category && <span className="error-text">{errors.category}</span>}
            </div>

            {selectedCategoryData && (
              <div className="form-group">
                <label>Подкатегория</label>
                <select
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleChange}
                >
                  <option value="">Выберите подкатегорию</option>
                  {selectedCategoryData.subcategories?.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Описание *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Опишите товар подробно..."
              rows={4}
              className={errors.description ? 'error' : ''}
            />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>

          <div className="form-group">
            <label>Состояние</label>
            <select
              name="condition"
              value={formData.condition}
              onChange={handleChange}
            >
              <option value="new">Новый</option>
              <option value="like_new">Как новый</option>
              <option value="good">Хорошее</option>
              <option value="fair">Удовлетворительное</option>
              <option value="poor">Требует ремонта</option>
            </select>
          </div>
        </div>

        {/* Price */}
        <div className="form-section">
          <h3>Цена</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Цена (₽) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className={errors.price ? 'error' : ''}
              />
              {errors.price && <span className="error-text">{errors.price}</span>}
            </div>
            
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="negotiable"
                  checked={formData.negotiable}
                  onChange={handleChange}
                />
                <span>Торг уместен</span>
              </label>
            </div>
          </div>
          
          {/* ALTYN COIN Payment */}
          <div className="altyn-payment-section" style={{ marginTop: '16px', padding: '16px', background: '#FEF3C7', borderRadius: '12px', border: '1px solid #F59E0B' }}>
            <div className="form-group checkbox-group" style={{ marginBottom: '12px' }}>
              <label className="checkbox-label" style={{ fontWeight: '600', color: '#92400E' }}>
                <input
                  type="checkbox"
                  name="accept_altyn"
                  checked={formData.accept_altyn}
                  onChange={handleChange}
                />
                <span>💰 Принимать оплату в ALTYN COIN</span>
              </label>
            </div>
            
            {formData.accept_altyn && (
              <div className="form-group">
                <label style={{ color: '#92400E' }}>Цена в ALTYN COIN (AC) *</label>
                <input
                  type="number"
                  name="altyn_price"
                  value={formData.altyn_price}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  style={{ borderColor: '#F59E0B' }}
                />
                <small style={{ color: '#B45309', display: 'block', marginTop: '4px' }}>
                  1 ALTYN COIN = 1 USD. Комиссия 0.1% с транзакции.
                </small>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="form-section">
          <h3>Местоположение</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Город</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Москва"
              />
            </div>
            
            <div className="form-group">
              <label>Адрес (опционально)</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Район, метро"
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="form-section">
          <h3>Контакты</h3>
          
          <div className="form-group">
            <label>Способ связи</label>
            <select
              name="contact_method"
              value={formData.contact_method}
              onChange={handleChange}
            >
              <option value="message">Только сообщения</option>
              <option value="phone">Только телефон</option>
              <option value="both">Сообщения и телефон</option>
            </select>
          </div>

          {(formData.contact_method === 'phone' || formData.contact_method === 'both') && (
            <div className="form-group">
              <label>Телефон</label>
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          )}
        </div>

        {/* Seller Type */}
        {organizations.length > 0 && (
          <div className="form-section">
            <h3>Продавец</h3>
            
            <div className="form-group">
              <label>Продавать как</label>
              <select
                name="organization_id"
                value={formData.organization_id}
                onChange={handleChange}
              >
                <option value="">Частное лицо</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="form-section">
          <h3>Теги</h3>
          <div className="form-group">
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="Теги через запятую: iphone, apple, смартфон"
            />
            <p className="hint">Теги помогут покупателям найти ваш товар</p>
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
            {loading ? 'Сохранение...' : (editProduct ? 'Сохранить' : 'Опубликовать')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MarketplaceListingForm;
