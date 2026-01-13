import React, { useState, useEffect, useCallback } from 'react';
import {
  Coins, TrendingUp, Users, Gift, Plus, Send, RefreshCw,
  DollarSign, PieChart, History, Wallet, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Search, ChevronDown, ChevronUp, X
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
};

const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{trend >= 0 ? '+' : ''}{trend}%</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

const TokenHolderRow = ({ holder, rank }) => (
  <div className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors">
    <div className="flex items-center gap-4">
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        rank === 1 ? 'bg-amber-500 text-white' :
        rank === 2 ? 'bg-slate-400 text-white' :
        rank === 3 ? 'bg-amber-700 text-white' :
        'bg-slate-700 text-slate-300'
      }`}>
        {rank}
      </span>
      <div>
        <p className="text-white font-medium">{holder.user_name}</p>
        <p className="text-slate-500 text-sm">{holder.user_id.slice(0, 8)}...</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-white font-semibold">{formatNumber(holder.token_balance)} AT</p>
      <p className="text-amber-400 text-sm">{holder.percentage.toFixed(2)}%</p>
    </div>
  </div>
);

const EmissionModal = ({ onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('Введите корректную сумму');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${BACKEND_URL}/admin/finance/emission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description: description || `Эмиссия ${parseFloat(amount).toLocaleString()} ALTYN COIN`
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Ошибка создания эмиссии');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Plus className="w-6 h-6 text-green-400" />
            Новая эмиссия ALTYN COIN
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-2">Сумма эмиссии (AC)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000000"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Описание (опционально)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Причина эмиссии..."
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !amount}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Coins className="w-5 h-5" />
                  Создать
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const InitializeTokensModal = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [tokens, setTokens] = useState('35000000');
  const [coins, setCoins] = useState('1000000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Введите email пользователя');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${BACKEND_URL}/finance/admin/initialize-tokens?user_email=${encodeURIComponent(email)}&token_amount=${tokens}&coin_amount=${coins}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Ошибка инициализации');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Инициализация токенов
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-2">Email пользователя</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investor@example.com"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">ALTYN TOKENS</label>
              <input
                type="number"
                value={tokens}
                onChange={(e) => setTokens(e.target.value)}
                placeholder="35000000"
                className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">ALTYN COINS</label>
              <input
                type="number"
                value={coins}
                onChange={(e) => setCoins(e.target.value)}
                placeholder="1000000"
                className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-amber-400 text-sm">
              <strong>Внимание:</strong> Всего может быть распределено 35,000,000 ALTYN TOKENS. 
              Убедитесь, что общее количество не превышает лимит.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  Инициализировать
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminAltynManagement = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [treasury, setTreasury] = useState(null);
  const [tokenHolders, setTokenHolders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [exchangeRates, setExchangeRates] = useState(null);
  
  const [showEmissionModal, setShowEmissionModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [distributingDividends, setDistributingDividends] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const showNotification = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch treasury stats (using admin endpoint)
      const treasuryRes = await fetch(`${BACKEND_URL}/admin/finance/treasury`, { headers });
      if (treasuryRes.ok) {
        const data = await treasuryRes.json();
        setTreasury(data);
      }

      // Fetch token holders (using admin endpoint)
      const holdersRes = await fetch(`${BACKEND_URL}/admin/finance/token-holders?limit=50`, { headers });
      if (holdersRes.ok) {
        const data = await holdersRes.json();
        setTokenHolders(data.holders || []);
      }

      // Fetch exchange rates
      const ratesRes = await fetch(`${BACKEND_URL}/finance/exchange-rates`);
      if (ratesRes.ok) {
        const data = await ratesRes.json();
        setExchangeRates(data.rates);
      }

      // Fetch wallets stats
      const walletsRes = await fetch(`${BACKEND_URL}/admin/database/status`, { headers });
      if (walletsRes.ok) {
        const data = await walletsRes.json();
        const walletsColl = data.collections?.find(c => c.name === 'wallets');
        const txColl = data.collections?.find(c => c.name === 'transactions');
        setWallets({
          count: walletsColl?.document_count || 0,
          transactions: txColl?.document_count || 0
        });
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDistributeDividends = async () => {
    if (!treasury?.treasury?.collected_fees || treasury.treasury.collected_fees <= 0) {
      showNotification('error', 'Нет комиссий для распределения');
      return;
    }

    if (!window.confirm(`Распределить ${treasury.treasury.collected_fees.toLocaleString()} AC между держателями токенов?`)) {
      return;
    }

    setDistributingDividends(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${BACKEND_URL}/admin/finance/distribute-dividends`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Ошибка распределения');
      }

      const data = await response.json();
      showNotification('success', `Распределено ${data.payout.total_distributed.toLocaleString()} AC между ${data.payout.holders_count} держателями`);
      fetchData();
    } catch (err) {
      showNotification('error', err.message);
    } finally {
      setDistributingDividends(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-4">Загрузка данных ALTYN...</p>
        </div>
      </div>
    );
  }

  const collectedFees = treasury?.treasury?.collected_fees || 0;
  const totalCoins = treasury?.treasury?.total_coins_in_circulation || 0;
  const totalTokens = treasury?.treasury?.total_token_supply || 35000000;
  const distributedTokens = tokenHolders.reduce((sum, h) => sum + h.token_balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Coins className="w-6 h-6 text-white" />
            </div>
            ALTYN Управление
          </h1>
          <p className="text-slate-400 mt-1">Управление цифровой валютой платформы</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          message.type === 'error' 
            ? 'bg-red-500/10 border-red-500/20 text-red-400' 
            : 'bg-green-500/10 border-green-500/20 text-green-400'
        }`}>
          {message.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <p>{message.text}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'overview', label: 'Обзор', icon: PieChart },
          { id: 'tokens', label: 'Токены', icon: TrendingUp },
          { id: 'transactions', label: 'История', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="ALTYN COIN в обороте"
              value={formatNumber(totalCoins) + ' AC'}
              subtitle="Стейблкоин (1 AC = 1 USD)"
              icon={Coins}
              color="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <StatCard
              title="ALTYN TOKENS"
              value={formatNumber(distributedTokens) + ' / ' + formatNumber(totalTokens)}
              subtitle={`${((distributedTokens / totalTokens) * 100).toFixed(2)}% распределено`}
              icon={TrendingUp}
              color="bg-gradient-to-br from-purple-500 to-purple-600"
            />
            <StatCard
              title="Собрано комиссий"
              value={collectedFees.toLocaleString() + ' AC'}
              subtitle="Готово к распределению"
              icon={Gift}
              color="bg-gradient-to-br from-green-500 to-green-600"
            />
            <StatCard
              title="Кошельков"
              value={wallets?.count || 0}
              subtitle={`${wallets?.transactions || 0} транзакций`}
              icon={Wallet}
              color="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />
          </div>

          {/* Exchange Rates */}
          {exchangeRates && (
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Курсы валют (1 ALTYN COIN = 1 USD)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm">USD</p>
                  <p className="text-2xl font-bold text-white">${exchangeRates.USD}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm">RUB</p>
                  <p className="text-2xl font-bold text-white">₽{exchangeRates.RUB?.toFixed(2)}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm">KZT</p>
                  <p className="text-2xl font-bold text-white">₸{exchangeRates.KZT?.toFixed(0)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setShowEmissionModal(true)}
              className="flex items-center justify-center gap-3 p-6 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 hover:border-amber-500/50 transition-all group"
            >
              <Plus className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="text-white font-semibold">Новая эмиссия</p>
                <p className="text-slate-400 text-sm">Выпустить ALTYN COIN</p>
              </div>
            </button>

            <button
              onClick={handleDistributeDividends}
              disabled={distributingDividends || collectedFees <= 0}
              className="flex items-center justify-center gap-3 p-6 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 hover:border-green-500/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {distributingDividends ? (
                <div className="w-8 h-8 border-3 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
              ) : (
                <Gift className="w-8 h-8 text-green-400 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <p className="text-white font-semibold">Распределить дивиденды</p>
                <p className="text-slate-400 text-sm">{collectedFees.toLocaleString()} AC для распределения</p>
              </div>
            </button>

            <button
              onClick={() => setShowInitModal(true)}
              className="flex items-center justify-center gap-3 p-6 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 hover:border-purple-500/50 transition-all group"
            >
              <Users className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="text-white font-semibold">Инициализация токенов</p>
                <p className="text-slate-400 text-sm">Выдать токены инвестору</p>
              </div>
            </button>
          </div>

          {/* Recent Emissions */}
          {treasury?.recent_emissions?.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Последние эмиссии
                </h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {treasury.recent_emissions.map((emission, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Coins className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-white font-medium">+{emission.amount.toLocaleString()} AC</p>
                        <p className="text-slate-500 text-sm">{emission.description}</p>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm">
                      {new Date(emission.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tokens Tab */}
      {activeTab === 'tokens' && (
        <div className="space-y-6">
          {/* Token Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <p className="text-slate-400 text-sm">Общий объем токенов</p>
              <p className="text-3xl font-bold text-white mt-2">{formatNumber(totalTokens)}</p>
              <p className="text-slate-500 text-xs mt-1">ALTYN TOKEN (AT)</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <p className="text-slate-400 text-sm">Распределено</p>
              <p className="text-3xl font-bold text-purple-400 mt-2">{formatNumber(distributedTokens)}</p>
              <p className="text-slate-500 text-xs mt-1">{((distributedTokens / totalTokens) * 100).toFixed(4)}% от общего</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <p className="text-slate-400 text-sm">Держателей токенов</p>
              <p className="text-3xl font-bold text-cyan-400 mt-2">{tokenHolders.length}</p>
              <p className="text-slate-500 text-xs mt-1">активных кошельков</p>
            </div>
          </div>

          {/* Token Holders List */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Users className="w-5 h-5" />
                Держатели ALTYN TOKEN
              </h3>
              <button
                onClick={() => setShowInitModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            </div>
            <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
              {tokenHolders.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Нет держателей токенов
                </div>
              ) : (
                tokenHolders.map((holder, idx) => (
                  <TokenHolderRow key={holder.user_id} holder={holder} rank={idx + 1} />
                ))
              )}
            </div>
          </div>

          {/* Token Economics Info */}
          <div className="bg-gradient-to-br from-amber-500/10 to-purple-500/10 rounded-xl p-6 border border-amber-500/20">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-amber-400" />
              Экономика ALTYN TOKEN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-slate-400 mb-2">📌 Фиксированное предложение</p>
                <p className="text-white">35,000,000 токенов — не может быть увеличено</p>
              </div>
              <div>
                <p className="text-slate-400 mb-2">💰 Дивиденды</p>
                <p className="text-white">0.1% от каждой транзакции ALTYN COIN распределяется между держателями</p>
              </div>
              <div>
                <p className="text-slate-400 mb-2">📊 Пропорциональное распределение</p>
                <p className="text-white">Дивиденды распределяются пропорционально % владения токенами</p>
              </div>
              <div>
                <p className="text-slate-400 mb-2">🏦 Казначейство</p>
                <p className="text-white">Комиссии накапливаются до момента распределения администратором</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Dividend History */}
          {treasury?.recent_dividends?.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Gift className="w-5 h-5 text-green-400" />
                  История распределения дивидендов
                </h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {treasury.recent_dividends.map((payout, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Send className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {payout.total_fees_distributed.toLocaleString()} AC распределено
                          </p>
                          <p className="text-slate-500 text-sm">
                            {payout.token_holders_count} получателей
                          </p>
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm">
                        {new Date(payout.distribution_date).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emissions History */}
          {treasury?.recent_emissions?.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  История эмиссий ALTYN COIN
                </h3>
              </div>
              <div className="divide-y divide-slate-700/50">
                {treasury.recent_emissions.map((emission, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">+{emission.amount.toLocaleString()} AC</p>
                        <p className="text-slate-500 text-sm">{emission.description}</p>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm">
                      {new Date(emission.created_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!treasury?.recent_emissions?.length && !treasury?.recent_dividends?.length) && (
            <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700/50 text-center">
              <History className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">История транзакций пуста</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showEmissionModal && (
        <EmissionModal
          onClose={() => setShowEmissionModal(false)}
          onSuccess={() => {
            showNotification('success', 'Эмиссия успешно создана');
            fetchData();
          }}
        />
      )}

      {showInitModal && (
        <InitializeTokensModal
          onClose={() => setShowInitModal(false)}
          onSuccess={() => {
            showNotification('success', 'Токены успешно инициализированы');
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default AdminAltynManagement;
