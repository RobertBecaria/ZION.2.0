/**
 * ServicesReviews Component
 * Display and manage service reviews
 */
import React, { useState, useEffect } from 'react';
import { 
  Star, ThumbsUp, MessageCircle, Flag, ChevronDown,
  Loader2, User, Calendar, Check, X, Edit2
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ServicesReviews = ({
  serviceId,
  serviceName,
  user,
  isProvider = false,
  moduleColor = '#B91C1C',
  onBack
}) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });
  
  // Review form state
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    content: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchReviews();
  }, [serviceId, sortBy]);

  const fetchReviews = async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/services/reviews/${serviceId}?sort=${sortBy}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        
        // Calculate stats
        const total = data.reviews?.length || 0;
        if (total > 0) {
          const sum = data.reviews.reduce((acc, r) => acc + r.rating, 0);
          const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          data.reviews.forEach(r => {
            distribution[r.rating] = (distribution[r.rating] || 0) + 1;
          });
          
          setStats({
            averageRating: sum / total,
            totalReviews: total,
            ratingDistribution: distribution
          });
        }
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!newReview.content.trim()) return;
    
    setSubmitting(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/services/reviews`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_id: serviceId,
          rating: newReview.rating,
          title: newReview.title,
          content: newReview.content
        })
      });
      
      if (response.ok) {
        setShowWriteReview(false);
        setNewReview({ rating: 5, title: '', content: '' });
        fetchReviews();
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProviderReply = async (reviewId) => {
    if (!replyText.trim()) return;
    
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${BACKEND_URL}/api/services/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ response: replyText })
      });
      
      if (response.ok) {
        setReplyingTo(null);
        setReplyText('');
        fetchReviews();
      }
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  };

  const handleHelpful = async (reviewId) => {
    try {
      const token = localStorage.getItem('zion_token');
      await fetch(`${BACKEND_URL}/api/services/reviews/${reviewId}/helpful`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchReviews();
    } catch (error) {
      console.error('Error marking helpful:', error);
    }
  };

  const renderStars = (rating, interactive = false, onRate = null) => {
    return (
      <div className="stars-container">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            className={`star-btn ${interactive ? 'interactive' : ''}`}
            onClick={() => interactive && onRate && onRate(star)}
            disabled={!interactive}
          >
            <Star
              size={interactive ? 28 : 16}
              fill={star <= rating ? '#FFC107' : 'none'}
              color="#FFC107"
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="services-reviews loading">
        <Loader2 size={32} className="spin" style={{ color: moduleColor }} />
        <p>Загрузка отзывов...</p>
      </div>
    );
  }

  return (
    <div className="services-reviews">
      {/* Header */}
      <div className="reviews-header">
        <div>
          <h2 style={{ color: moduleColor }}>⭐ Отзывы</h2>
          {serviceName && <p>{serviceName}</p>}
        </div>
        
        {!isProvider && (
          <button
            className="write-review-btn"
            onClick={() => setShowWriteReview(true)}
            style={{ backgroundColor: moduleColor }}
          >
            <Edit2 size={16} />
            Написать отзыв
          </button>
        )}
      </div>

      {/* Stats Overview */}
      <div className="reviews-stats">
        <div className="stats-main">
          <div className="average-rating">
            <span className="rating-value">{stats.averageRating.toFixed(1)}</span>
            <div className="rating-meta">
              {renderStars(Math.round(stats.averageRating))}
              <span>{stats.totalReviews} отзывов</span>
            </div>
          </div>
        </div>
        
        <div className="rating-bars">
          {[5, 4, 3, 2, 1].map(rating => {
            const count = stats.ratingDistribution[rating] || 0;
            const percentage = stats.totalReviews > 0 
              ? (count / stats.totalReviews) * 100 
              : 0;
            return (
              <div key={rating} className="bar-row">
                <span className="bar-label">{rating}</span>
                <Star size={12} fill="#FFC107" color="#FFC107" />
                <div className="bar-track">
                  <div 
                    className="bar-fill" 
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: moduleColor 
                    }}
                  />
                </div>
                <span className="bar-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sort Options */}
      <div className="reviews-toolbar">
        <div className="sort-select">
          <label>Сортировка:</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="recent">Сначала новые</option>
            <option value="rating_high">Высокий рейтинг</option>
            <option value="rating_low">Низкий рейтинг</option>
            <option value="helpful">Полезные</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="no-reviews">
          <Star size={48} color="#D1D5DB" />
          <h3>Пока нет отзывов</h3>
          <p>Станьте первым, кто оставит отзыв!</p>
        </div>
      ) : (
        <div className="reviews-list">
          {reviews.map(review => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div className="reviewer-info">
                  {review.user?.profile_picture ? (
                    <img 
                      src={review.user.profile_picture} 
                      alt="" 
                      className="reviewer-avatar" 
                    />
                  ) : (
                    <div 
                      className="reviewer-avatar-placeholder"
                      style={{ backgroundColor: `${moduleColor}20` }}
                    >
                      <User size={20} style={{ color: moduleColor }} />
                    </div>
                  )}
                  <div>
                    <span className="reviewer-name">
                      {review.user?.first_name} {review.user?.last_name}
                    </span>
                    <span className="review-date">
                      <Calendar size={12} />
                      {new Date(review.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
                
                <div className="review-rating">
                  {renderStars(review.rating)}
                </div>
              </div>
              
              {review.title && (
                <h4 className="review-title">{review.title}</h4>
              )}
              
              <p className="review-content">{review.content}</p>
              
              {/* Provider Response */}
              {review.provider_response && (
                <div className="provider-response">
                  <div className="response-header">
                    <strong>Ответ компании</strong>
                  </div>
                  <p>{review.provider_response}</p>
                </div>
              )}
              
              {/* Review Actions */}
              <div className="review-actions">
                <button 
                  className="helpful-btn"
                  onClick={() => handleHelpful(review.id)}
                >
                  <ThumbsUp size={14} />
                  Полезно ({review.helpful_count || 0})
                </button>
                
                {isProvider && !review.provider_response && (
                  <button
                    className="reply-btn"
                    onClick={() => setReplyingTo(review.id)}
                  >
                    <MessageCircle size={14} />
                    Ответить
                  </button>
                )}
              </div>
              
              {/* Reply Form (Provider) */}
              {replyingTo === review.id && (
                <div className="reply-form">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Напишите ответ на отзыв..."
                    rows={3}
                  />
                  <div className="reply-actions">
                    <button 
                      className="btn-secondary"
                      onClick={() => { setReplyingTo(null); setReplyText(''); }}
                    >
                      Отмена
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => handleProviderReply(review.id)}
                      style={{ backgroundColor: moduleColor }}
                    >
                      Отправить
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Write Review Modal */}
      {showWriteReview && (
        <div className="modal-overlay" onClick={() => setShowWriteReview(false)}>
          <div className="write-review-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Оставить отзыв</h3>
              <button className="close-btn" onClick={() => setShowWriteReview(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="rating-selector">
                <label>Ваша оценка</label>
                {renderStars(newReview.rating, true, (rating) => 
                  setNewReview({ ...newReview, rating })
                )}
              </div>
              
              <div className="form-group">
                <label>Заголовок (необязательно)</label>
                <input
                  type="text"
                  value={newReview.title}
                  onChange={e => setNewReview({ ...newReview, title: e.target.value })}
                  placeholder="Кратко опишите впечатление"
                />
              </div>
              
              <div className="form-group">
                <label>Ваш отзыв</label>
                <textarea
                  value={newReview.content}
                  onChange={e => setNewReview({ ...newReview, content: e.target.value })}
                  placeholder="Расскажите о своём опыте..."
                  rows={5}
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowWriteReview(false)}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmitReview}
                disabled={!newReview.content.trim() || submitting}
                style={{ backgroundColor: moduleColor }}
              >
                {submitting ? (
                  <><Loader2 size={16} className="spin" /> Отправка...</>
                ) : (
                  <><Check size={16} /> Опубликовать</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesReviews;
