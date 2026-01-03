/**
 * ERIC Search Result Cards
 * Interactive cards for search results with action buttons
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Building2, ShoppingBag, MessageCircle,
  MapPin, Star, DollarSign
} from 'lucide-react';
import './ERICSearchCards.css';

const ERICSearchCards = ({ cards }) => {
  const navigate = useNavigate();

  const handleAction = (card) => {
    if (card.action?.route) {
      navigate(card.action.route);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'service':
        return <Calendar size={16} />;
      case 'organization':
        return <Building2 size={16} />;
      case 'product':
        return <ShoppingBag size={16} />;
      case 'person':
        return <MessageCircle size={16} />;
      case 'recommendation':
        return <Star size={16} />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'service':
        return 'Услуга';
      case 'organization':
        return 'Организация';
      case 'product':
        return 'Товар';
      case 'person':
        return 'Человек';
      case 'recommendation':
        return 'Рекомендация';
      default:
        return type;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'service':
        return '#10B981'; // Green
      case 'organization':
        return '#6366F1'; // Indigo
      case 'product':
        return '#F59E0B'; // Amber
      case 'person':
        return '#EC4899'; // Pink
      case 'recommendation':
        return '#8B5CF6'; // Purple
      default:
        return '#6B7280';
    }
  };

  if (!cards || cards.length === 0) return null;

  return (
    <div className="eric-search-cards">
      {cards.map((card, index) => (
        <div 
          key={card.id || index} 
          className="eric-search-card"
          style={{ '--card-color': getTypeColor(card.type) }}
        >
          <div className="eric-card-header">
            <span 
              className="eric-card-type"
              style={{ backgroundColor: getTypeColor(card.type) }}
            >
              {getTypeIcon(card.type)}
              {getTypeLabel(card.type)}
            </span>
          </div>
          
          <div className="eric-card-body">
            <h4 className="eric-card-title">{card.name}</h4>
            {card.description && (
              <p className="eric-card-description">{card.description}</p>
            )}
            
            <div className="eric-card-meta">
              {card.metadata?.city && (
                <span className="eric-card-meta-item">
                  <MapPin size={12} />
                  {card.metadata.city}
                </span>
              )}
              {card.metadata?.rating && (
                <span className="eric-card-meta-item rating">
                  <Star size={12} />
                  {card.metadata.rating}
                </span>
              )}
              {(card.metadata?.price_from || card.metadata?.price) && (
                <span className="eric-card-meta-item price">
                  <DollarSign size={12} />
                  {card.metadata.price_from || card.metadata.price} {card.metadata.currency || 'RUB'}
                </span>
              )}
            </div>
          </div>
          
          {card.action && (
            <button 
              className="eric-card-action"
              onClick={() => handleAction(card)}
              style={{ backgroundColor: getTypeColor(card.type) }}
            >
              {card.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ERICSearchCards;
