/**
 * MyListings Component
 * Shows user's marketplace listings
 */
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Archive } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  active: { label: 'Активно', color: '#10B981' },
  sold: { label: 'Продано', color: '#6B7280' },
  reserved: { label: 'Забронировано', color: '#F59E0B' },
  archived: { label: 'В архиве', color: '#9CA3AF' }
};

const MyListings = ({
  token,
  moduleColor = '#BE185D',
  onCreateNew,
  onEdit,
  onViewProduct
}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/marketplace/my-products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [token]);

  const handleStatusChange = async (productId, newStatus) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/marketplace/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        fetchProducts();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Удалить объявление?')) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/marketplace/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0
    }).format(price);
  };

  const filteredProducts = filter === 'all' 
    ? products 
    : products.filter(p => p.status === filter);

  const stats = {
    active: products.filter(p => p.status === 'active').length,
    sold: products.filter(p => p.status === 'sold').length,
    total: products.length
  };

  return (
    <div className="my-listings">
      <div className="listings-header">
        <h1>Мои объявления</h1>
        <button
          className="create-btn"
          style={{ backgroundColor: moduleColor }}
          onClick={onCreateNew}
        >
          <Plus size={18} />
          Добавить
        </button>
      </div>

      {/* Stats */}
      <div className="listings-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Всего</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: '#10B981' }}>{stats.active}</span>
          <span className="stat-label">Активных</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: moduleColor }}>{stats.sold}</span>
          <span className="stat-label">Продано</span>
        </div>
      </div>

      {/* Filter */}
      <div className="listings-filter">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
          style={filter === 'all' ? { backgroundColor: moduleColor } : {}}
        >
          Все
        </button>
        <button
          className={filter === 'active' ? 'active' : ''}
          onClick={() => setFilter('active')}
          style={filter === 'active' ? { backgroundColor: moduleColor } : {}}
        >
          Активные
        </button>
        <button
          className={filter === 'sold' ? 'active' : ''}
          onClick={() => setFilter('sold')}
          style={filter === 'sold' ? { backgroundColor: moduleColor } : {}}
        >
          Проданные
        </button>
        <button
          className={filter === 'archived' ? 'active' : ''}
          onClick={() => setFilter('archived')}
          style={filter === 'archived' ? { backgroundColor: moduleColor } : {}}
        >
          Архив
        </button>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" style={{ borderTopColor: moduleColor }}></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state">
          <span>📦</span>
          <h3>Нет объявлений</h3>
          <p>Создайте своё первое объявление</p>
          <button
            className="create-first-btn"
            style={{ backgroundColor: moduleColor }}
            onClick={onCreateNew}
          >
            <Plus size={18} />
            Создать объявление
          </button>
        </div>
      ) : (
        <div className="listings-list">
          {filteredProducts.map(product => (
            <div key={product.id} className="listing-item">
              <div className="listing-image" onClick={() => onViewProduct?.(product)}>
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt="" />
                ) : (
                  <span>📦</span>
                )}
              </div>
              
              <div className="listing-info">
                <h3 onClick={() => onViewProduct?.(product)}>{product.title}</h3>
                <p className="listing-price" style={{ color: moduleColor }}>
                  {formatPrice(product.price)}
                </p>
                <div className="listing-meta">
                  <span
                    className="status-badge"
                    style={{ backgroundColor: STATUS_LABELS[product.status]?.color }}
                  >
                    {STATUS_LABELS[product.status]?.label}
                  </span>
                  <span className="views">
                    <Eye size={14} /> {product.view_count || 0}
                  </span>
                </div>
              </div>
              
              <div className="listing-actions">
                <button onClick={() => onEdit?.(product)} title="Редактировать">
                  <Edit2 size={18} />
                </button>
                
                {product.status === 'active' ? (
                  <button
                    onClick={() => handleStatusChange(product.id, 'sold')}
                    title="Отметить как проданное"
                  >
                    <EyeOff size={18} />
                  </button>
                ) : product.status === 'sold' || product.status === 'archived' ? (
                  <button
                    onClick={() => handleStatusChange(product.id, 'active')}
                    title="Восстановить"
                  >
                    <Eye size={18} />
                  </button>
                ) : null}
                
                <button
                  onClick={() => handleStatusChange(product.id, 'archived')}
                  title="В архив"
                >
                  <Archive size={18} />
                </button>
                
                <button
                  onClick={() => handleDelete(product.id)}
                  className="delete-btn"
                  title="Удалить"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyListings;
