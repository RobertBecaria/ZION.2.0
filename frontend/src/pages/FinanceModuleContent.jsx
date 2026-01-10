import React, { memo, lazy, Suspense } from 'react';

// Lazy load component
const WalletDashboard = lazy(() => import('../components/finances').then(m => ({ default: m.WalletDashboard })));

const LoadingFallback = () => <div className="module-loading"><div className="loading-spinner" /><p>Загрузка...</p></div>;

/**
 * Finance Module Content (ФИНАНСЫ) - Optimized with memoization and lazy loading
 */
const FinanceModuleContent = memo(function FinanceModuleContent({
  user,
  currentModule,
}) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WalletDashboard
        user={user}
        moduleColor={currentModule.color}
      />
    </Suspense>
  );
});

export default FinanceModuleContent;
