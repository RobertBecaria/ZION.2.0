/**
 * MarketplaceProductDetail Component
 * Detailed view of a marketplace product
 */
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Heart, Share2, MapPin, Clock, Eye, Phone, MessageCircle,
  User, Building2, ChevronLeft, ChevronRight, AlertCircle, Coins, Wallet,
  CheckCircle, X
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
  user,
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentReceipt, setPaymentReceipt] = useState(null);

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

  // Fetch wallet balance for ALTYN payment
  useEffect(() => {
    const fetchWallet = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/finance/wallet`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setWalletBalance(data.wallet?.coin_balance || 0);
        }
      } catch (error) {
        console.error('Error fetching wallet:', error);
      }
    };
    fetchWallet();
  }, [token]);

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

  const handleAltynPayment = async () => {
    if (!token || !product?.altyn_price) return;
    
    setPaymentLoading(true);
    setPaymentError(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/finance/marketplace/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: productId,
          amount: product.altyn_price
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPaymentSuccess(true);
        setPaymentReceipt(data.receipt);
        // Refresh wallet balance
        const walletRes = await fetch(`${BACKEND_URL}/api/finance/wallet`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (walletRes.ok) {
          const walletData = await walletRes.json();
          setWalletBalance(walletData.wallet?.coin_balance || 0);
        }
      } else {
        setPaymentError(data.detail || 'Ошибка оплаты');
      }
    } catch (error) {
      setPaymentError('Ошибка подключения к серверу');
    } finally {
      setPaymentLoading(false);
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
            
            {/* ALTYN COIN Price */}
            {product.accept_altyn && product.altyn_price && (
              <div className="altyn-price-section" style={{ 
                marginTop: '12px', 
                padding: '12px 16px', 
                background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', 
                borderRadius: '12px',
                border: '1px solid #F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Coins size={24} style={{ color: '#B45309' }} />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#92400E' }}>
                      {product.altyn_price.toLocaleString('ru-RU')} AC
                    </div>
                    <div style={{ fontSize: '12px', color: '#B45309' }}>
                      ALTYN COIN ≈ ${product.altyn_price.toLocaleString('en-US')} USD
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={product.status === 'SOLD' || (user && product.seller_id === user.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: product.status === 'SOLD' ? '#9CA3AF' : 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: product.status === 'SOLD' ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <Wallet size={18} />
                  {product.status === 'SOLD' ? 'Продано' : 'Оплатить ALTYN'}
                </button>
              </div>
            )}

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
      
      {/* ALTYN Payment Modal */}
      {showPaymentModal && product?.accept_altyn && (
        <div className="payment-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="payment-modal" style={{
            background: 'white',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '440px',
            padding: '0',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Coins size={24} style={{ color: '#F59E0B' }} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Оплата ALTYN COIN</h3>
              </div>
              <button onClick={() => {
                setShowPaymentModal(false);
                setPaymentSuccess(false);
                setPaymentError(null);
              }} style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px'
              }}>
                <X size={20} style={{ color: '#64748b' }} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {paymentSuccess ? (
                <div style={{ padding: '0' }}>
                  {/* Success Header */}
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <CheckCircle size={48} style={{ color: '#10B981', marginBottom: '12px' }} />
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#1e293b' }}>Оплата успешна!</h4>
                    <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Транзакция завершена</p>
                  </div>
                  
                  {/* Receipt */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    border: '1px dashed #cbd5e1'
                  }}>
                    <div style={{ 
                      textAlign: 'center', 
                      borderBottom: '1px solid #e2e8f0', 
                      paddingBottom: '12px', 
                      marginBottom: '16px' 
                    }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Квитанция об оплате
                      </span>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        № {paymentReceipt?.receipt_id?.slice(0, 8).toUpperCase() || '---'}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{product.title}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(paymentReceipt?.date || Date.now()).toLocaleString('ru-RU', {
                          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b' }}>Покупатель:</span>
                        <span style={{ color: '#1e293b' }}>{paymentReceipt?.buyer_name || '---'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b' }}>Продавец:</span>
                        <span style={{ color: '#1e293b' }}>{paymentReceipt?.seller_name || '---'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b' }}>Сумма:</span>
                        <span style={{ color: '#1e293b' }}>{paymentReceipt?.item_price?.toLocaleString('ru-RU')} AC</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b' }}>Комиссия ({paymentReceipt?.fee_rate}):</span>
                        <span style={{ color: '#1e293b' }}>{paymentReceipt?.fee_amount?.toFixed(2)} AC</span>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        paddingTop: '12px', 
                        borderTop: '1px solid #e2e8f0',
                        fontWeight: '700',
                        fontSize: '16px'
                      }}>
                        <span style={{ color: '#1e293b' }}>Итого оплачено:</span>
                        <span style={{ color: '#F59E0B' }}>{paymentReceipt?.total_paid?.toLocaleString('ru-RU')} AC</span>
                      </div>
                    </div>
                    
                    <div style={{ 
                      marginTop: '16px', 
                      textAlign: 'center',
                      padding: '8px',
                      background: '#ECFDF5',
                      borderRadius: '8px'
                    }}>
                      <span style={{ 
                        color: '#10B981', 
                        fontSize: '12px', 
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}>
                        <CheckCircle size={14} />
                        {paymentReceipt?.status === 'COMPLETED' ? 'Оплата завершена' : 'Обработка'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => window.location.href = '/?module=finance'}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Wallet size={16} />
                      Мой кошелёк
                    </button>
                    <button
                      onClick={() => {
                        setShowPaymentModal(false);
                        setPaymentSuccess(false);
                        setPaymentReceipt(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#10B981',
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
                </div>
              ) : (
                <>
                  {paymentError && (
                    <div style={{
                      padding: '12px 16px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '10px',
                      color: '#DC2626',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle size={18} />
                      {paymentError}
                    </div>
                  )}
                  
                  {/* Product Info */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    marginBottom: '20px'
                  }}>
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt="" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '60px', height: '60px', borderRadius: '10px', background: '#e2e8f0' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{product.title}</div>
                      <div style={{ fontSize: '14px', color: '#64748b' }}>Продавец: {product.seller_name}</div>
                    </div>
                  </div>
                  
                  {/* Payment Details */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>Сумма</span>
                      <span style={{ fontWeight: '600' }}>{product.altyn_price?.toLocaleString('ru-RU')} AC</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>Комиссия (0.1%)</span>
                      <span style={{ fontWeight: '600' }}>{(product.altyn_price * 0.001).toFixed(2)} AC</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: '700', fontSize: '18px' }}>
                      <span style={{ color: '#1e293b' }}>Итого</span>
                      <span style={{ color: '#F59E0B' }}>{product.altyn_price?.toLocaleString('ru-RU')} AC</span>
                    </div>
                  </div>
                  
                  {/* Wallet Balance */}
                  <div style={{
                    padding: '16px',
                    background: walletBalance >= product.altyn_price ? '#F0FDF4' : '#FEF2F2',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Wallet size={20} style={{ color: walletBalance >= product.altyn_price ? '#10B981' : '#DC2626' }} />
                      <span style={{ color: '#64748b' }}>Ваш баланс:</span>
                    </div>
                    <span style={{ fontWeight: '700', color: walletBalance >= product.altyn_price ? '#10B981' : '#DC2626' }}>
                      {walletBalance.toLocaleString('ru-RU')} AC
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      style={{
                        flex: 1,
                        padding: '14px',
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleAltynPayment}
                      disabled={paymentLoading || walletBalance < product.altyn_price}
                      style={{
                        flex: 1,
                        padding: '14px',
                        background: walletBalance >= product.altyn_price ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : '#9CA3AF',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        color: 'white',
                        cursor: walletBalance >= product.altyn_price && !paymentLoading ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {paymentLoading ? 'Оплата...' : (
                        walletBalance < product.altyn_price ? 'Недостаточно средств' : (
                          <>
                            <Coins size={18} />
                            Оплатить
                          </>
                        )
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceProductDetail;
