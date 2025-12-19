/**
 * ServiceProviderProfile Component
 * Detailed view of a service provider's profile
 */
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Star, MapPin, Phone, Mail, Globe, Clock,
  Calendar, MessageCircle, Share2, Heart, ChevronRight
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

const ServiceProviderProfile = ({ 
  listingId,
  listing: initialListing,
  onBack,
  onBookAppointment,
  onViewReviews,
  moduleColor = '#B91C1C',
  user
}) => {
  const [listing, setListing] = useState(initialListing || null);
  const [loading, setLoading] = useState(!initialListing);
  const [activeTab, setActiveTab] = useState('about');
  const [reviews, setReviews] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!initialListing && listingId) {
      fetchListing();
    }
  }, [listingId, initialListing]);

  useEffect(() => {
    if (listing?.id) {
      fetchReviews();
    }
  }, [listing?.id]);

  const fetchListing = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/services/listings/${listingId}`);
      if (response.ok) {
        const data = await response.json();
        setListing(data.listing);
      }
    } catch (error) {
      console.error('Error fetching listing:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/services/reviews/${listing.id}`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const formatPrice = () => {
    if (!listing?.price_from && !listing?.price_to) return 'Цена по запросу';
    if (listing?.price_type === 'from') return `от ${listing.price_from?.toLocaleString()} ₽`;
    if (listing?.price_from && listing?.price_to) {
      return `${listing.price_from?.toLocaleString()} - ${listing.price_to?.toLocaleString()} ₽`;
    }
    return `${(listing?.price_from || listing?.price_to)?.toLocaleString()} ₽`;
  };

  if (loading) {
    return (
      <div className="service-profile-loading">
        <div className="spinner" style={{ borderTopColor: moduleColor }}></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="service-profile-error">
        <h3>Услуга не найдена</h3>
        <button onClick={onBack}>Назад к поиску</button>
      </div>
    );
  }

  return (
    <div className="service-provider-profile">
      {/* Header */}
      <div className="profile-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
          Назад
        </button>
        
        <div className="profile-actions">
          <button 
            className={`action-btn ${isFavorite ? 'active' : ''}`}
            onClick={() => setIsFavorite(!isFavorite)}
          >
            <Heart size={20} fill={isFavorite ? moduleColor : 'none'} color={isFavorite ? moduleColor : undefined} />
          </button>
          <button className="action-btn">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="profile-hero">
        <div className="profile-images">
          {listing.images?.length > 0 ? (
            <div className="images-gallery">
              <img src={listing.images[0]} alt={listing.name} className="main-image" />
              {listing.images.slice(1, 4).map((img, idx) => (
                <img key={idx} src={img} alt="" className="thumb-image" />
              ))}
            </div>
          ) : (
            <div 
              className="profile-placeholder"
              style={{ backgroundColor: `${moduleColor}20` }}
            >
              <span style={{ color: moduleColor, fontSize: '4rem' }}>
                {listing.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="profile-main-info">
          <h1>{listing.name}</h1>
          
          {listing.organization?.name && (
            <p className="org-name">
              <span>Организация:</span> {listing.organization.name}
            </p>
          )}
          
          <div className="rating-section">
            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map(star => (
                <Star 
                  key={star} 
                  size={20} 
                  fill={star <= Math.round(listing.rating || 0) ? '#FFC107' : 'none'}
                  color="#FFC107"
                />
              ))}
            </div>
            <span className="rating-value">{listing.rating?.toFixed(1) || '0.0'}</span>
            <span className="review-count">({listing.review_count || 0} отзывов)</span>
          </div>
          
          <div className="price-tag" style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}>
            {formatPrice()}
          </div>
          
          {/* Quick Actions */}
          <div className="quick-actions">
            {listing.accepts_online_booking && (
              <button 
                className="book-btn"
                style={{ backgroundColor: moduleColor }}
                onClick={() => onBookAppointment && onBookAppointment(listing)}
              >
                <Calendar size={18} />
                Записаться онлайн
              </button>
            )}
            
            {listing.phone && (
              <a href={`tel:${listing.phone}`} className="contact-btn">
                <Phone size={18} />
                Позвонить
              </a>
            )}
            
            <button className="message-btn">
              <MessageCircle size={18} />
              Написать
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button 
          className={activeTab === 'about' ? 'active' : ''}
          onClick={() => setActiveTab('about')}
          style={activeTab === 'about' ? { borderColor: moduleColor, color: moduleColor } : {}}
        >
          О компании
        </button>
        <button 
          className={activeTab === 'reviews' ? 'active' : ''}
          onClick={() => setActiveTab('reviews')}
          style={activeTab === 'reviews' ? { borderColor: moduleColor, color: moduleColor } : {}}
        >
          Отзывы ({listing.review_count || 0})
        </button>
        <button 
          className={activeTab === 'contacts' ? 'active' : ''}
          onClick={() => setActiveTab('contacts')}
          style={activeTab === 'contacts' ? { borderColor: moduleColor, color: moduleColor } : {}}
        >
          Контакты
        </button>
      </div>

      {/* Tab Content */}
      <div className="profile-tab-content">
        {activeTab === 'about' && (
          <div className="about-tab">
            <h3>Описание</h3>
            <p className="description">{listing.description}</p>
            
            {listing.tags?.length > 0 && (
              <div className="tags-section">
                <h4>Теги</h4>
                <div className="tags-list">
                  {listing.tags.map(tag => (
                    <span key={tag} className="tag" style={{ backgroundColor: `${moduleColor}15`, color: moduleColor }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="reviews-tab">
            {reviews.length === 0 ? (
              <div className="no-reviews">
                <p>Пока нет отзывов</p>
              </div>
            ) : (
              <div className="reviews-list">
                {reviews.map(review => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <div className="reviewer-info">
                        {review.user?.profile_picture ? (
                          <img src={review.user.profile_picture} alt="" className="reviewer-avatar" />
                        ) : (
                          <div className="reviewer-avatar-placeholder">
                            {review.user?.first_name?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div>
                          <span className="reviewer-name">
                            {review.user?.first_name} {review.user?.last_name}
                          </span>
                          <span className="review-date">
                            {new Date(review.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </div>
                      <div className="review-rating">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star 
                            key={star} 
                            size={14} 
                            fill={star <= review.rating ? '#FFC107' : 'none'}
                            color="#FFC107"
                          />
                        ))}
                      </div>
                    </div>
                    {review.title && <h4 className="review-title">{review.title}</h4>}
                    <p className="review-content">{review.content}</p>
                    
                    {review.provider_response && (
                      <div className="provider-response">
                        <strong>Ответ компании:</strong>
                        <p>{review.provider_response}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="contacts-tab">
            {listing.address && (
              <div className="contact-item">
                <MapPin size={20} style={{ color: moduleColor }} />
                <div>
                  <strong>Адрес</strong>
                  <p>{listing.address}, {listing.city}</p>
                </div>
              </div>
            )}
            
            {listing.phone && (
              <div className="contact-item">
                <Phone size={20} style={{ color: moduleColor }} />
                <div>
                  <strong>Телефон</strong>
                  <a href={`tel:${listing.phone}`}>{listing.phone}</a>
                </div>
              </div>
            )}
            
            {listing.email && (
              <div className="contact-item">
                <Mail size={20} style={{ color: moduleColor }} />
                <div>
                  <strong>Email</strong>
                  <a href={`mailto:${listing.email}`}>{listing.email}</a>
                </div>
              </div>
            )}
            
            {listing.website && (
              <div className="contact-item">
                <Globe size={20} style={{ color: moduleColor }} />
                <div>
                  <strong>Веб-сайт</strong>
                  <a href={listing.website} target="_blank" rel="noopener noreferrer">{listing.website}</a>
                </div>
              </div>
            )}
            
            {listing.working_hours && (
              <div className="working-hours">
                <h4><Clock size={18} /> Часы работы</h4>
                <div className="hours-list">
                  {DAYS_OF_WEEK.map(day => {
                    const hours = listing.working_hours[day.key];
                    return (
                      <div key={day.key} className="hours-row">
                        <span className="day-name">{day.label}</span>
                        <span className="day-hours">
                          {hours?.closed ? 'Выходной' : 
                           hours ? `${hours.open} - ${hours.close}` : 'Не указано'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceProviderProfile;
