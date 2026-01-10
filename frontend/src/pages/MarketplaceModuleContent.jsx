import React from 'react';
import {
  MarketplaceSearch,
  MarketplaceProductDetail,
  MarketplaceListingForm,
  MyListings,
  MarketplaceFavorites,
  MyThings,
  MyThingsItemForm
} from '../components/marketplace';
import { ERICProfile } from '../components/eric';

/**
 * Marketplace Module Content (ВЕЩИ) - Extracted from App.js
 * Handles all marketplace-related views
 */
function MarketplaceModuleContent({
  activeView,
  setActiveView,
  user,
  currentModule,
  selectedMarketplaceProduct,
  setSelectedMarketplaceProduct,
  editMarketplaceProduct,
  setEditMarketplaceProduct,
  selectedInventoryCategory,
  setSelectedInventoryCategory,
  editInventoryItem,
  setEditInventoryItem,
  listForSaleItem,
  setListForSaleItem,
}) {
  const token = localStorage.getItem('zion_token');

  // Get category view map
  const categoryViewMap = {
    smart_things: 'my-things-smart',
    wardrobe: 'my-things-wardrobe',
    garage: 'my-things-garage',
    home: 'my-things-home',
    electronics: 'my-things-electronics',
    collection: 'my-things-collection'
  };

  const getCategoryFromView = (view) => {
    const reverseMap = {
      'my-things-smart': 'smart_things',
      'my-things-wardrobe': 'wardrobe',
      'my-things-garage': 'garage',
      'my-things-home': 'home',
      'my-things-electronics': 'electronics',
      'my-things-collection': 'collection'
    };
    return reverseMap[view] || selectedInventoryCategory;
  };

  // Marketplace Search/Browse
  if ((activeView === 'marketplace-search' || activeView === 'wall' || activeView === 'feed') && !selectedMarketplaceProduct) {
    return (
      <MarketplaceSearch
        user={user}
        token={token}
        moduleColor={currentModule.color}
        onViewProduct={(product) => {
          setSelectedMarketplaceProduct(product);
          setActiveView('marketplace-product-detail');
        }}
        onCreateListing={() => {
          setEditMarketplaceProduct(null);
          setActiveView('marketplace-create-listing');
        }}
      />
    );
  }

  // Product Detail
  if (activeView === 'marketplace-product-detail' && selectedMarketplaceProduct) {
    return (
      <MarketplaceProductDetail
        productId={selectedMarketplaceProduct.id}
        token={token}
        moduleColor={currentModule.color}
        onBack={() => {
          setSelectedMarketplaceProduct(null);
          setActiveView('marketplace-search');
        }}
        onContactSeller={(product) => console.log('Contact seller:', product.seller_id)}
      />
    );
  }

  // Create/Edit Listing
  if (activeView === 'marketplace-create-listing') {
    return (
      <MarketplaceListingForm
        user={user}
        token={token}
        moduleColor={currentModule.color}
        editProduct={editMarketplaceProduct}
        onBack={() => {
          setEditMarketplaceProduct(null);
          setActiveView('marketplace-my-listings');
        }}
        onSuccess={() => {
          setEditMarketplaceProduct(null);
          setActiveView('marketplace-my-listings');
        }}
      />
    );
  }

  // My Listings
  if (activeView === 'marketplace-my-listings') {
    return (
      <MyListings
        token={token}
        moduleColor={currentModule.color}
        onCreateNew={() => {
          setEditMarketplaceProduct(null);
          setActiveView('marketplace-create-listing');
        }}
        onEdit={(product) => {
          setEditMarketplaceProduct(product);
          setActiveView('marketplace-create-listing');
        }}
        onViewProduct={(product) => {
          setSelectedMarketplaceProduct(product);
          setActiveView('marketplace-product-detail');
        }}
      />
    );
  }

  // Favorites
  if (activeView === 'marketplace-favorites') {
    return (
      <MarketplaceFavorites
        token={token}
        moduleColor={currentModule.color}
        onViewProduct={(product) => {
          setSelectedMarketplaceProduct(product);
          setActiveView('marketplace-product-detail');
        }}
      />
    );
  }

  // ERIC AI Assistant
  if (activeView === 'eric-ai') {
    return <ERICProfile user={user} />;
  }

  // My Things views
  const myThingsViews = ['my-things', 'my-things-smart', 'my-things-wardrobe', 'my-things-garage', 'my-things-home', 'my-things-electronics', 'my-things-collection'];
  if (myThingsViews.includes(activeView) && !editInventoryItem && !listForSaleItem) {
    return (
      <MyThings
        user={user}
        token={token}
        moduleColor={currentModule.color}
        selectedCategory={getCategoryFromView(activeView)}
        onCategoryChange={(category) => {
          setSelectedInventoryCategory(category);
          if (category) {
            setActiveView(categoryViewMap[category] || 'my-things');
          } else {
            setActiveView('my-things');
          }
        }}
        onAddItem={() => {
          setEditInventoryItem(null);
          setActiveView('my-things-add-item');
        }}
        onViewItem={(item) => {
          setEditInventoryItem(item);
          setActiveView('my-things-add-item');
        }}
        onEditItem={(item) => {
          setEditInventoryItem(item);
          setActiveView('my-things-add-item');
        }}
        onListForSale={(item) => setListForSaleItem(item)}
      />
    );
  }

  // Add/Edit Inventory Item
  if (activeView === 'my-things-add-item') {
    return (
      <MyThingsItemForm
        token={token}
        moduleColor={currentModule.color}
        editItem={editInventoryItem}
        defaultCategory={selectedInventoryCategory}
        onBack={() => {
          setEditInventoryItem(null);
          setActiveView(categoryViewMap[selectedInventoryCategory] || 'my-things');
        }}
        onSuccess={() => {
          setEditInventoryItem(null);
          setActiveView(categoryViewMap[selectedInventoryCategory] || 'my-things');
        }}
      />
    );
  }

  // Default: Marketplace Search
  return (
    <MarketplaceSearch
      user={user}
      token={token}
      moduleColor={currentModule.color}
      onViewProduct={(product) => {
        setSelectedMarketplaceProduct(product);
        setActiveView('marketplace-product-detail');
      }}
      onCreateListing={() => {
        setEditMarketplaceProduct(null);
        setActiveView('marketplace-create-listing');
      }}
    />
  );
}

export default MarketplaceModuleContent;
