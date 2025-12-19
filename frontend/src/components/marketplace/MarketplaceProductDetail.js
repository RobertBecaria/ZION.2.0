/**
 * MarketplaceProductDetail Component
 * Detailed view of a marketplace product
 */
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Heart, Share2, MapPin, Clock, Eye, Phone, MessageCircle,
  User, Building2, ChevronLeft, ChevronRight, AlertCircle
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CONDITION_LABELS = {
  new: 'Новый',
  like_new: 'Как новый',
  good: 'Хорошее',
  fair: 'Удовлетворительное',
  poor: 'Требует ремонта'
};

const MarketplaceProductDetail = ({
  productId,
  token,
  moduleColor = '#BE185D',
  onBack,
  onContactSeller,
  onViewSellerProfile
}) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/marketplace/products/${productId}`);
        if (response.ok) {
          const data = await response.json();
          setProduct(data);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const handleToggleFavorite = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/marketplace/favorites/${productId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.is_favorite);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Ссылка скопирована!');
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="product-detail-loading">
        <div className="spinner" style={{ borderTopColor: moduleColor }}></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail-error">
        <AlertCircle size={48} />
        <h3>Товар не найден</h3>
        <button onClick={onBack}>Вернуться назад</button>
      </div>
    );
  }

  const images = product.images?.length > 0 ? product.images : [null];

  return (
    <div className="marketplace-product-detail">
      {/* Header */}
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
          Назад
        </button>
        <div className="header-actions">
          <button
            className={`action-btn ${isFavorite ? 'active' : ''}`}
            onClick={handleToggleFavorite}
          >
            <Heart size={20} fill={isFavorite ? moduleColor : 'none'} color={isFavorite ? moduleColor : undefined} />
          </button>
          <button className="action-btn" onClick={handleShare}>
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <div className="detail-content">
        {/* Image Gallery */}
        <div className="image-gallery">
          <div className="main-image">
            {images[currentImageIndex] ? (
              <img src={images[currentImageIndex]} alt={product.title} />
            ) : (
              <div className="image-placeholder">
                <span>📦</span>
              </div>
            )}
            
            {images.length > 1 && (
              <>
                <button
                  className="gallery-nav prev"
                  onClick={() => setCurrentImageIndex(i => i > 0 ? i - 1 : images.length - 1)}
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  className="gallery-nav next"
                  onClick={() => setCurrentImageIndex(i => i < images.length - 1 ? i + 1 : 0)}
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
          
          {images.length > 1 && (
            <div className="image-thumbnails">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  className={`thumbnail ${idx === currentImageIndex ? 'active' : ''}`}
                  onClick={() => setCurrentImageIndex(idx)}
                  style={idx === currentImageIndex ? { borderColor: moduleColor } : {}}
                >
                  {img ? <img src={img} alt="" /> : <span>📦</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="product-info">
          <div className="info-main">
            <h1 className="product-title">{product.title}</h1>
            
            <div className="product-price" style={{ color: moduleColor }}>
              {formatPrice(product.price)}
              {product.negotiable && <span className="negotiable-tag">Торг уместен</span>}
            </div>

            <div className="product-badges">
              <span className="badge condition" data-condition={product.condition}>
                {CONDITION_LABELS[product.condition]}
              </span>
              {product.seller_type === 'organization' && (
                <span className="badge organization">
                  <Building2 size={14} />
                  Организация
                </span>
              )}
            </div>

            <div className="product-meta-row">
              {product.city && (
                <span><MapPin size={16} /> {product.city}</span>
              )}
              <span><Clock size={16} /> {formatDate(product.created_at)}</span>
              <span><Eye size={16} /> {product.view_count} просмотров</span>
            </div>

            <div className="product-description">
              <h3>Описание</h3>
              <p>{product.description}</p>
            </div>

            {product.tags?.length > 0 && (
              <div className="product-tags">
                {product.tags.map((tag, idx) => (
                  <span key={idx} className="tag">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Seller Card */}
          <div className="seller-card">
            <h3>Продавец</h3>
            <div className="seller-info" onClick={() => onViewSellerProfile?.(product.seller_id)}>
              {product.seller_type === 'organization' ? (
                <>
                  {product.organization_logo ? (
                    <img src={product.organization_logo} alt="" className="seller-avatar" />
                  ) : (
                    <div className="seller-avatar-placeholder">
                      <Building2 size={24} />
                    </div>
                  )}
                  <div className="seller-details">
                    <span className="seller-name">{product.organization_name}</span>
                    <span className="seller-type">Организация</span>
                  </div>
                </>
              ) : (
                <>
                  {product.seller_avatar ? (
                    <img src={product.seller_avatar} alt="" className="seller-avatar" />
                  ) : (
                    <div className="seller-avatar-placeholder">
                      <User size={24} />
                    </div>
                  )}
                  <div className="seller-details">
                    <span className="seller-name">{product.seller_name || 'Частное лицо'}</span>
                    <span className="seller-type">Частный продавец</span>
                  </div>
                </>
              )}
            </div>

            {/* Contact Buttons */}
            <div className="contact-buttons">
              <button
                className="contact-btn primary"
                style={{ backgroundColor: moduleColor }}
                onClick={() => onContactSeller?.(product)}
              >
                <MessageCircle size={18} />
                Написать сообщение
              </button>
              
              {(product.contact_method === 'phone' || product.contact_method === 'both') && product.contact_phone && (
                <button
                  className="contact-btn secondary"
                  onClick={() => setShowPhone(!showPhone)}
                >
                  <Phone size={18} />
                  {showPhone ? product.contact_phone : 'Показать телефон'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceProductDetail;
