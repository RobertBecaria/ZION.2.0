/**
 * WalletDashboard Component
 * Main dashboard showing ALTYN COIN and TOKEN balances
 */
import React, { useState, useEffect } from 'react';
import { 
  Wallet, Coins, TrendingUp, Send, ArrowDownLeft, ArrowUpRight,
  RefreshCw, DollarSign, Percent, Gift, Building2, ChevronRight
} from 'lucide-react';
import SendCoins from './SendCoins';
import TransactionHistory from './TransactionHistory';
import TokenPortfolio from './TokenPortfolio';
import ExchangeRates from './ExchangeRates';
import AdminFinance from './AdminFinance';
import CorporateWallets from './CorporateWallets';

const WalletDashboard = ({ user, moduleColor = '#A16207' }) => {
  const [wallet, setWallet] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAssetType, setSendAssetType] = useState('COIN');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      const [walletRes, portfolioRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/finance/wallet`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/finance/portfolio`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (walletRes.ok) {
        const walletData = await walletRes.json();
        setWallet(walletData.wallet);
      }

      if (portfolioRes.ok) {
        const portfolioData = await portfolioRes.json();
        setPortfolio(portfolioData);
      }
    } catch (err) {
      console.error('Error fetching wallet:', err);
      setError('Ошибка загрузки кошелька');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSendCoins = () => {
    setSendAssetType('COIN');
    setShowSendModal(true);
  };

  const handleSendTokens = () => {
    setSendAssetType('TOKEN');
    setShowSendModal(true);
  };

  const handleTransferSuccess = () => {
    setShowSendModal(false);
    handleRefresh();
  };

  const formatNumber = (num, decimals = 2) => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  };

  const formatLargeNumber = (num) => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    }
    return formatNumber(num);
  };

  if (loading) {
    return (
      <div className="wallet-dashboard loading">
        <div className="loading-spinner">
          <RefreshCw size={32} className="spin" />
          <p>Загрузка кошелька...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wallet-dashboard error">
        <p>{error}</p>
        <button onClick={handleRefresh}>Повторить</button>
      </div>
    );
  }

  const coinBalance = wallet?.coin_balance || 0;
  const tokenBalance = wallet?.token_balance || 0;
  const tokenPercentage = wallet?.token_percentage || 0;
  const pendingDividends = wallet?.pending_dividends || 0;
  const totalDividends = wallet?.total_dividends_received || 0;

  const rates = portfolio?.exchange_rates || {};
  const coinInRub = coinBalance * (rates.RUB || 90);
  const coinInKzt = coinBalance * (rates.KZT || 450);

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="wallet-dashboard" style={{ '--module-color': moduleColor }}>
      {/* Header */}
      <div className="wallet-header">
        <div className="header-title">
          <Wallet size={28} style={{ color: moduleColor }} />
          <h2>МОЙ КОШЕЛЁК</h2>
        </div>
        <button className="refresh-btn" onClick={handleRefresh}>
          <RefreshCw size={18} />
          Обновить
        </button>
      </div>

      {/* Balance Cards */}
      <div className="balance-cards">
        {/* ALTYN COIN Card */}
        <div className="balance-card coin-card">
          <div className="card-header">
            <div className="card-icon" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}>
              <Coins size={24} />
            </div>
            <span className="card-label">ALTYN COIN</span>
          </div>
          <div className="card-balance">
            <span className="balance-amount">{formatNumber(coinBalance)}</span>
            <span className="balance-symbol">AC</span>
          </div>
          <div className="card-equivalents">
            <span>≈ ${formatNumber(coinBalance)} USD</span>
            <span>≈ ₽{formatNumber(coinInRub)} RUB</span>
            <span>≈ ₸{formatNumber(coinInKzt)} KZT</span>
          </div>
          <div className="card-actions">
            <button className="action-btn send" onClick={handleSendCoins}>
              <Send size={16} />
              Отправить
            </button>
            <button className="action-btn receive">
              <ArrowDownLeft size={16} />
              Получить
            </button>
          </div>
        </div>

        {/* ALTYN TOKEN Card */}
        <div className="balance-card token-card">
          <div className="card-header">
            <div className="card-icon" style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}>
              <TrendingUp size={24} />
            </div>
            <span className="card-label">ALTYN TOKEN</span>
          </div>
          <div className="card-balance">
            <span className="balance-amount">{formatLargeNumber(tokenBalance)}</span>
            <span className="balance-symbol">AT</span>
          </div>
          <div className="card-stats">
            <div className="stat">
              <Percent size={14} />
              <span>{tokenPercentage.toFixed(4)}% владения</span>
            </div>
            <div className="stat">
              <Gift size={14} />
              <span>Дивиденды: {formatNumber(totalDividends)} AC</span>
            </div>
          </div>
          <div className="card-actions">
            <button className="action-btn send" onClick={handleSendTokens}>
              <Send size={16} />
              Передать
            </button>
            <button className="action-btn portfolio" onClick={() => setActiveTab('portfolio')}>
              <TrendingUp size={16} />
              Портфель
            </button>
          </div>
        </div>

        {/* Pending Dividends Card */}
        {pendingDividends > 0 && (
          <div className="balance-card dividends-card">
            <div className="card-header">
              <div className="card-icon" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
                <Gift size={24} />
              </div>
              <span className="card-label">ОЖИДАЕМЫЕ ДИВИДЕНДЫ</span>
            </div>
            <div className="card-balance">
              <span className="balance-amount">{formatNumber(pendingDividends)}</span>
              <span className="balance-symbol">AC</span>
            </div>
            <p className="card-note">Дивиденды распределяются ежедневно или по запросу администратора</p>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="wallet-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
          style={activeTab === 'overview' ? { borderColor: moduleColor, color: moduleColor } : {}}
        >
          <Wallet size={18} />
          Обзор
        </button>
        <button 
          className={`tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
          style={activeTab === 'transactions' ? { borderColor: moduleColor, color: moduleColor } : {}}
        >
          <ArrowUpRight size={18} />
          Транзакции
        </button>
        <button 
          className={`tab ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
          style={activeTab === 'portfolio' ? { borderColor: moduleColor, color: moduleColor } : {}}
        >
          <TrendingUp size={18} />
          Портфель
        </button>
        <button 
          className={`tab ${activeTab === 'rates' ? 'active' : ''}`}
          onClick={() => setActiveTab('rates')}
          style={activeTab === 'rates' ? { borderColor: moduleColor, color: moduleColor } : {}}
        >
          <DollarSign size={18} />
          Курсы
        </button>
        <button 
          className={`tab ${activeTab === 'corporate' ? 'active' : ''}`}
          onClick={() => setActiveTab('corporate')}
          style={activeTab === 'corporate' ? { borderColor: moduleColor, color: moduleColor } : {}}
        >
          <Building2 size={18} />
          Бизнес
        </button>
        {isAdmin && (
          <button 
            className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
            style={activeTab === 'admin' ? { borderColor: '#DC2626', color: '#DC2626' } : {}}
          >
            ⚙️
            Админ
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="wallet-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h3>Последние транзакции</h3>
            <TransactionHistory limit={5} compact moduleColor={moduleColor} />
            <button className="view-all-btn" onClick={() => setActiveTab('transactions')}>
              Все транзакции <ChevronRight size={16} />
            </button>
          </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionHistory moduleColor={moduleColor} />
        )}

        {activeTab === 'portfolio' && (
          <TokenPortfolio 
            wallet={wallet} 
            portfolio={portfolio} 
            moduleColor={moduleColor} 
          />
        )}

        {activeTab === 'rates' && (
          <ExchangeRates moduleColor={moduleColor} />
        )}

        {activeTab === 'corporate' && (
          <CorporateWallets user={user} moduleColor={moduleColor} />
        )}

        {activeTab === 'admin' && isAdmin && (
          <AdminFinance 
            onRefresh={handleRefresh} 
            moduleColor={moduleColor}
            userEmail={user?.email}
          />
        )}
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <SendCoins
          assetType={sendAssetType}
          currentBalance={sendAssetType === 'COIN' ? coinBalance : tokenBalance}
          onClose={() => setShowSendModal(false)}
          onSuccess={handleTransferSuccess}
          moduleColor={moduleColor}
        />
      )}

      <style jsx>{`
        .wallet-dashboard {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          color: #64748b;
        }

        .loading-spinner .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .wallet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-title h2 {
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #64748b;
          transition: all 0.2s;
        }

        .refresh-btn:hover {
          background: #f8fafc;
          border-color: var(--module-color);
          color: var(--module-color);
        }

        .balance-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .balance-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border: 1px solid #f1f5f9;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .card-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .card-label {
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-balance {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 12px;
        }

        .balance-amount {
          font-size: 36px;
          font-weight: 700;
          color: #1e293b;
        }

        .balance-symbol {
          font-size: 18px;
          font-weight: 600;
          color: #64748b;
        }

        .card-equivalents {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
        }

        .card-equivalents span {
          font-size: 13px;
          color: #64748b;
          background: #f8fafc;
          padding: 4px 10px;
          border-radius: 6px;
        }

        .card-stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .card-stats .stat {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #64748b;
        }

        .card-note {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        .card-actions {
          display: flex;
          gap: 12px;
        }

        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .action-btn.send {
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          color: white;
        }

        .action-btn.send:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .action-btn.receive {
          background: #f1f5f9;
          color: #475569;
        }

        .action-btn.receive:hover {
          background: #e2e8f0;
        }

        .action-btn.portfolio {
          background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%);
          color: white;
        }

        .action-btn.portfolio:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .dividends-card {
          background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
          border-color: #A7F3D0;
        }

        .wallet-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 16px;
          overflow-x: auto;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .tab:hover {
          color: #1e293b;
        }

        .tab.active {
          color: var(--module-color);
          border-bottom-color: var(--module-color);
        }

        .wallet-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .overview-section h3 {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 16px 0;
        }

        .view-all-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          margin-top: 16px;
          transition: all 0.2s;
        }

        .view-all-btn:hover {
          background: #f1f5f9;
          color: var(--module-color);
        }
      `}</style>
    </div>
  );
};

export default WalletDashboard;
