import React from 'react';
import { WalletDashboard } from '../components/finances';

/**
 * Finance Module Content (ФИНАНСЫ) - Extracted from App.js
 * Handles all finance/wallet-related views
 */
function FinanceModuleContent({
  activeView,
  user,
  currentModule,
}) {
  // All views show WalletDashboard for now
  return (
    <WalletDashboard
      user={user}
      moduleColor={currentModule.color}
    />
  );
}

export default FinanceModuleContent;
