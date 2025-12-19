/**
 * MarketplaceFavorites Component
 * Shows user's favorite/wishlisted products
 */
import React, { useState, useEffect } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import MarketplaceProductCard from './MarketplaceProductCard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MarketplaceFavorites = ({
  token,
  moduleColor = '#BE185D',
  onViewProduct
}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/marketplace/favorites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [token]);

  const handleRemoveFavorite = async (productId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/marketplace/favorites/${productId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setProducts(prev => prev.filter(p => p.id !== productId));
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  return (
    <div className="marketplace-favorites">
      <div className="favorites-header">
        <h1>
          <Heart size={24} color={moduleColor} />
          Избранное
        </h1>
        <span className="count">{products.length} товаров</span>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" style={{ borderTopColor: moduleColor }}></div>
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <Heart size={48} color="#E5E7EB" />
          <h3>Список пуст</h3>
          <p>Добавляйте понравившиеся товары в избранное</p>
        </div>
      ) : (
        <div className="products-grid grid">
          {products.map(product => (
            <MarketplaceProductCard
              key={product.id}
              product={product}
              onSelect={onViewProduct}
              onToggleFavorite={handleRemoveFavorite}
              isFavorite={true}
              moduleColor={moduleColor}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplaceFavorites;
