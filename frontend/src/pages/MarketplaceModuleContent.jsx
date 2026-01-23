import React, { memo, useCallback, lazy, Suspense, useMemo } from 'react';

// Lazy load all components
const MarketplaceSearch = lazy(() => import('../components/marketplace').then(m => ({ default: m.MarketplaceSearch })));
const MarketplaceProductDetail = lazy(() => import('../components/marketplace').then(m => ({ default: m.MarketplaceProductDetail })));
const MarketplaceListingForm = lazy(() => import('../components/marketplace').then(m => ({ default: m.MarketplaceListingForm })));
const MyListings = lazy(() => import('../components/marketplace').then(m => ({ default: m.MyListings })));
const MarketplaceFavorites = lazy(() => import('../components/marketplace').then(m => ({ default: m.MarketplaceFavorites })));
const MyThings = lazy(() => import('../components/marketplace').then(m => ({ default: m.MyThings })));
const MyThingsItemForm = lazy(() => import('../components/marketplace').then(m => ({ default: m.MyThingsItemForm })));
const ERICProfile = lazy(() => import('../components/eric').then(m => ({ default: m.ERICProfile })));

const LoadingFallback = () => <div className="module-loading"><div className="loading-spinner" /><p>Загрузка...</p></div>;

// Category to view mapping
const CATEGORY_VIEW_MAP = {
  smart_things: 'my-things-smart',
  wardrobe: 'my-things-wardrobe',
  garage: 'my-things-garage',
  home: 'my-things-home',
  electronics: 'my-things-electronics',
  collection: 'my-things-collection'
};

const VIEW_TO_CATEGORY_MAP = Object.fromEntries(
  Object.entries(CATEGORY_VIEW_MAP).map(([k, v]) => [v, k])
);

const MY_THINGS_VIEWS = ['my-things', ...Object.values(CATEGORY_VIEW_MAP)];

/**
 * Marketplace Module Content (ВЕЩИ) - Optimized with memoization and lazy loading
 */
const MarketplaceModuleContent = memo(function MarketplaceModuleContent({
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
  const { color: moduleColor } = currentModule;
  const token = useMemo(() => localStorage.getItem('zion_token'), []);

  // Get category from view
  const currentCategory = useMemo(() => 
    VIEW_TO_CATEGORY_MAP[activeView] || selectedInventoryCategory,
    [activeView, selectedInventoryCategory]
  );

  // Memoized handlers
  const handleViewProduct = useCallback((product) => {
    setSelectedMarketplaceProduct(product);
    setActiveView('marketplace-product-detail');
  }, [setSelectedMarketplaceProduct, setActiveView]);

  const handleCreateListing = useCallback(() => {
    setEditMarketplaceProduct(null);
    setActiveView('marketplace-create-listing');
  }, [setEditMarketplaceProduct, setActiveView]);

  const handleBackToSearch = useCallback(() => {
    setSelectedMarketplaceProduct(null);
    setActiveView('marketplace-search');
  }, [setSelectedMarketplaceProduct, setActiveView]);

  const handleBackToMyListings = useCallback(() => {
    setEditMarketplaceProduct(null);
    setActiveView('marketplace-my-listings');
  }, [setEditMarketplaceProduct, setActiveView]);

  const handleEditProduct = useCallback((product) => {
    setEditMarketplaceProduct(product);
    setActiveView('marketplace-create-listing');
  }, [setEditMarketplaceProduct, setActiveView]);

  const handleCategoryChange = useCallback((category) => {
    setSelectedInventoryCategory(category);
    setActiveView(category ? (CATEGORY_VIEW_MAP[category] || 'my-things') : 'my-things');
  }, [setSelectedInventoryCategory, setActiveView]);

  const handleAddItem = useCallback(() => {
    setEditInventoryItem(null);
    setActiveView('my-things-add-item');
  }, [setEditInventoryItem, setActiveView]);

  const handleViewEditItem = useCallback((item) => {
    setEditInventoryItem(item);
    setActiveView('my-things-add-item');
  }, [setEditInventoryItem, setActiveView]);

  const handleBackFromItemForm = useCallback(() => {
    setEditInventoryItem(null);
    setActiveView(CATEGORY_VIEW_MAP[selectedInventoryCategory] || 'my-things');
  }, [setEditInventoryItem, setActiveView, selectedInventoryCategory]);

  // View renderer
  const renderContent = () => {
    // Marketplace Search/Browse
    if ((activeView === 'marketplace-search' || activeView === 'wall' || activeView === 'feed') && !selectedMarketplaceProduct) {
      return (
        <MarketplaceSearch
          user={user}
          token={token}
          moduleColor={moduleColor}
          onViewProduct={handleViewProduct}
          onCreateListing={handleCreateListing}
        />
      );
    }

    // Product Detail
    if (activeView === 'marketplace-product-detail' && selectedMarketplaceProduct) {
      return (
        <MarketplaceProductDetail
          productId={selectedMarketplaceProduct.id}
          token={token}
          moduleColor={moduleColor}
          onBack={handleBackToSearch}
          onContactSeller={(product) => { /* TODO: Implement contact seller */ }}
        />
      );
    }

    // Create/Edit Listing
    if (activeView === 'marketplace-create-listing') {
      return (
        <MarketplaceListingForm
          user={user}
          token={token}
          moduleColor={moduleColor}
          editProduct={editMarketplaceProduct}
          onBack={handleBackToMyListings}
          onSuccess={handleBackToMyListings}
        />
      );
    }

    // My Listings
    if (activeView === 'marketplace-my-listings') {
      return (
        <MyListings
          token={token}
          moduleColor={moduleColor}
          onCreateNew={handleCreateListing}
          onEdit={handleEditProduct}
          onViewProduct={handleViewProduct}
        />
      );
    }

    // Favorites
    if (activeView === 'marketplace-favorites') {
      return (
        <MarketplaceFavorites
          token={token}
          moduleColor={moduleColor}
          onViewProduct={handleViewProduct}
        />
      );
    }

    // ERIC AI
    if (activeView === 'eric-ai') {
      return <ERICProfile user={user} />;
    }

    // My Things views
    if (MY_THINGS_VIEWS.includes(activeView) && !editInventoryItem && !listForSaleItem) {
      return (
        <MyThings
          user={user}
          token={token}
          moduleColor={moduleColor}
          selectedCategory={currentCategory}
          onCategoryChange={handleCategoryChange}
          onAddItem={handleAddItem}
          onViewItem={handleViewEditItem}
          onEditItem={handleViewEditItem}
          onListForSale={setListForSaleItem}
        />
      );
    }

    // Add/Edit Inventory Item
    if (activeView === 'my-things-add-item') {
      return (
        <MyThingsItemForm
          token={token}
          moduleColor={moduleColor}
          editItem={editInventoryItem}
          defaultCategory={selectedInventoryCategory}
          onBack={handleBackFromItemForm}
          onSuccess={handleBackFromItemForm}
        />
      );
    }

    // Default: Marketplace Search
    return (
      <MarketplaceSearch
        user={user}
        token={token}
        moduleColor={moduleColor}
        onViewProduct={handleViewProduct}
        onCreateListing={handleCreateListing}
      />
    );
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      {renderContent()}
    </Suspense>
  );
});

export default MarketplaceModuleContent;
