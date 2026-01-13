import React, { useState, useEffect, useCallback } from 'react';
import {
  Coins, TrendingUp, Users, Gift, Plus, Send, RefreshCw,
  DollarSign, PieChart, History, Wallet, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Search, X, RotateCcw, Eye,
  Building, CreditCard, ArrowRightLeft, Landmark, FileText
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toLocaleString() || '0';
};

const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
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
        <p className="text-slate-500 text-sm">{holder.email || holder.user_id?.slice(0, 8) + '...'}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-white font-semibold">{formatNumber(holder.token_balance)} AT</p>
      <p className="text-amber-400 text-sm">{holder.percentage?.toFixed(2)}%</p>
    </div>
  </div>
);

// Modal for sending from Master Wallet
const SendFromTreasuryModal = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !amount) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${BACKEND_URL}/admin/finance/master-wallet/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to_user_email: email,
          amount: parseFloat(amount),
          description: description || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Ошибка отправки');
      }

      const data = await response.json();
      onSuccess(data);
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
            <Send className="w-6 h-6 text-green-400" />
            Перевод из казначейства
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
            <label className="block text-sm text-slate-400 mb-2">Email получателя</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Сумма (AC)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Описание (опционально)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Причина перевода..."
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
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
              disabled={loading || !email || !amount}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Отправить
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal for new emission
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
            <Plus className="w-6 h-6 text-amber-400" />
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
            <label className="block text-sm text-slate-400 mb-2">Описание</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Причина эмиссии..."
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-amber-400 text-sm">
              Новые монеты будут добавлены в казначейство (Master Wallet).
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors">
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !amount}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Coins className="w-5 h-5" />Создать</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal for initializing tokens (tokens only, no coins)
const InitializeTokensModal = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [tokens, setTokens] = useState('0');
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
        `${BACKEND_URL}/admin/finance/initialize-tokens?user_email=${encodeURIComponent(email)}&token_amount=${tokens}&coin_amount=0`,
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
            <TrendingUp className="w-6 h-6 text-purple-400" />
            Выдать ALTYN TOKENS
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

          <div>
            <label className="block text-sm text-slate-400 mb-2">Количество ALTYN TOKENS</label>
            <input
              type="number"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
            <p className="text-purple-400 text-sm">
              <strong>Макс. объем:</strong> 35,000,000 AT<br />
              Токены дают право на получение дивидендов от комиссий.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors">
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><TrendingUp className="w-5 h-5" />Выдать</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal for welcome bonus
const WelcomeBonusModal = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('100');
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
        `${BACKEND_URL}/admin/finance/give-welcome-bonus?user_email=${encodeURIComponent(email)}&amount=${amount}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Ошибка');
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
            <Gift className="w-6 h-6 text-pink-400" />
            Выдать Welcome Bonus
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
              placeholder="newuser@example.com"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Сумма бонуса (AC)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              min="1"
              className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors">
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Gift className="w-5 h-5" />Выдать</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Transaction Detail Modal
const TransactionDetailModal = ({ txCode, onClose, onReverse }) => {
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [showReverseForm, setShowReverseForm] = useState(false);

  useEffect(() => {
    const fetchTx = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch(`${BACKEND_URL}/admin/finance/transactions/${txCode}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setTx(data.transaction);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTx();
  }, [txCode]);

  const handleReverse = async () => {
    if (!reverseReason) return;
    setReversing(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(
        `${BACKEND_URL}/admin/finance/transactions/${txCode}/reverse?reason=${encodeURIComponent(reverseReason)}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (response.ok) {
        onReverse();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReversing(false);
    }
  };

  const txTypeLabels = {
    'TRANSFER': 'Перевод',
    'PAYMENT': 'Оплата',
    'FEE': 'Комиссия',
    'DIVIDEND': 'Дивиденды',
    'EMISSION': 'Эмиссия',
    'WELCOME_BONUS': 'Welcome Bonus'
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            Транзакция
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {tx && (
          <div className="p-6 space-y-4">
            {/* Transaction Code */}
            <div className="bg-slate-900/50 rounded-lg p-4 text-center">
              <p className="text-slate-400 text-sm">Код транзакции</p>
              <p className="text-2xl font-mono font-bold text-cyan-400">{tx.code || tx.id?.slice(0, 8)}</p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2">
              {tx.is_reversed ? (
                <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm flex items-center gap-1">
                  <RotateCcw className="w-4 h-4" /> Отменена
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Выполнена
                </span>
              )}
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm">
                {txTypeLabels[tx.transaction_type] || tx.transaction_type}
              </span>
            </div>

            {/* Amount */}
            <div className="text-center">
              <p className="text-4xl font-bold text-white">
                {tx.amount?.toLocaleString()} <span className="text-amber-400">{tx.asset_type === 'COIN' ? 'AC' : 'AT'}</span>
              </p>
              {tx.fee_amount > 0 && (
                <p className="text-slate-500 text-sm">Комиссия: {tx.fee_amount} AC</p>
              )}
            </div>

            {/* From/To */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">От</p>
                <p className="text-white font-medium">{tx.from_user?.name || 'Unknown'}</p>
                {tx.from_user?.email && <p className="text-slate-500 text-xs">{tx.from_user.email}</p>}
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Кому</p>
                <p className="text-white font-medium">{tx.to_user?.name || 'Unknown'}</p>
                {tx.to_user?.email && <p className="text-slate-500 text-xs">{tx.to_user.email}</p>}
              </div>
            </div>

            {/* Description */}
            {tx.description && (
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-slate-400 text-xs mb-1">Описание</p>
                <p className="text-white">{tx.description}</p>
              </div>
            )}

            {/* Date */}
            <div className="text-center text-slate-400 text-sm">
              {new Date(tx.created_at).toLocaleString('ru-RU')}
            </div>

            {/* Reversal Info */}
            {tx.is_reversed && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm">
                  <strong>Причина отмены:</strong> {tx.reversal_reason}<br />
                  <strong>Отменил:</strong> {tx.reversed_by}<br />
                  <strong>Дата:</strong> {new Date(tx.reversed_at).toLocaleString('ru-RU')}
                </p>
              </div>
            )}

            {/* Reverse Action */}
            {!tx.is_reversed && !tx.original_transaction_id && (
              <>
                {showReverseForm ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-3">
                    <p className="text-red-400 font-medium">Отмена транзакции</p>
                    <input
                      type="text"
                      value={reverseReason}
                      onChange={(e) => setReverseReason(e.target.value)}
                      placeholder="Причина отмены..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-red-500/30 text-white focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowReverseForm(false)}
                        className="flex-1 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleReverse}
                        disabled={!reverseReason || reversing}
                        className="flex-1 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {reversing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <RotateCcw className="w-4 h-4" />}
                        Отменить
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReverseForm(true)}
                    className="w-full py-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Отменить транзакцию
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Component
const AdminAltynManagement = () => {
  const [loading, setLoading] = useState(true);
  const [treasury, setTreasury] = useState(null);
  const [masterWallet, setMasterWallet] = useState(null);
  const [tokenHolders, setTokenHolders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [stats, setStats] = useState(null);
  
  const [showSendModal, setShowSendModal] = useState(false);
  const [showEmissionModal, setShowEmissionModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  
  const [distributingDividends, setDistributingDividends] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [txSearch, setTxSearch] = useState('');
  const [txPage, setTxPage] = useState(0);

  const showNotification = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch master wallet
      const walletRes = await fetch(`${BACKEND_URL}/admin/finance/master-wallet`, { headers });
      if (walletRes.ok) {
        const data = await walletRes.json();
        setMasterWallet(data);
      }

      // Fetch treasury stats
      const treasuryRes = await fetch(`${BACKEND_URL}/admin/finance/treasury`, { headers });
      if (treasuryRes.ok) {
        const data = await treasuryRes.json();
        setTreasury(data);
      }

      // Fetch token holders
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

      // Fetch stats
      const statsRes = await fetch(`${BACKEND_URL}/admin/finance/stats`, { headers });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        skip: txPage * 50,
        limit: 50,
        ...(txSearch && { search: txSearch })
      });
      
      const response = await fetch(`${BACKEND_URL}/admin/finance/transactions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [txPage, txSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    }
  }, [activeTab, fetchTransactions]);

  const handleDistributeDividends = async () => {
    const fees = treasury?.treasury?.collected_fees || 0;
    if (fees <= 0) {
      showNotification('error', 'Нет комиссий для распределения');
      return;
    }

    if (!window.confirm(`Распределить ${fees.toLocaleString()} AC между держателями токенов?`)) return;

    setDistributingDividends(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${BACKEND_URL}/admin/finance/distribute-dividends`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        showNotification('success', `Распределено ${data.payout.total_distributed.toLocaleString()} AC`);
        fetchData();
      }
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
          <p className="text-slate-400 mt-4">Загрузка Центрального Банка...</p>
        </div>
      </div>
    );
  }

  const treasuryBalance = masterWallet?.treasury?.coin_balance || 0;
  const collectedFees = treasury?.treasury?.collected_fees || 0;
  const totalCoins = treasury?.treasury?.total_coins_in_circulation || 0;
  const totalTokens = treasury?.treasury?.total_token_supply || 35000000;
  const distributedTokens = tokenHolders.reduce((sum, h) => sum + h.token_balance, 0);

  const txTypeLabels = {
    'TRANSFER': 'Перевод',
    'PAYMENT': 'Оплата',
    'FEE': 'Комиссия',
    'DIVIDEND': 'Дивиденды',
    'EMISSION': 'Эмиссия',
    'WELCOME_BONUS': 'Bonus'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Landmark className="w-6 h-6 text-white" />
            </div>
            Центральный Банк ALTYN
          </h1>
          <p className="text-slate-400 mt-1">Управление цифровой валютой платформы</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
          {message.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          <p>{message.text}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Обзор', icon: PieChart },
          { id: 'wallet', label: 'Master Wallet', icon: Wallet },
          { id: 'tokens', label: 'Токены', icon: TrendingUp },
          { id: 'transactions', label: 'Транзакции', icon: ArrowRightLeft },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Master Wallet" value={formatNumber(treasuryBalance) + ' AC'} subtitle="Баланс казначейства" icon={Building} color="bg-gradient-to-br from-green-500 to-green-600" />
            <StatCard title="В обороте" value={formatNumber(totalCoins) + ' AC'} subtitle="ALTYN COIN" icon={Coins} color="bg-gradient-to-br from-amber-500 to-amber-600" />
            <StatCard title="Комиссии" value={formatNumber(collectedFees) + ' AC'} subtitle="К распределению" icon={CreditCard} color="bg-gradient-to-br from-cyan-500 to-cyan-600" />
            <StatCard title="Токены" value={`${formatNumber(distributedTokens)} / ${formatNumber(totalTokens)}`} subtitle={`${((distributedTokens / totalTokens) * 100).toFixed(2)}% распределено`} icon={TrendingUp} color="bg-gradient-to-br from-purple-500 to-purple-600" />
          </div>

          {exchangeRates && (
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Курсы (1 AC = 1 USD)
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

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button onClick={() => setShowEmissionModal(true)} className="flex items-center gap-3 p-5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 hover:border-amber-500/50 transition-all group">
              <Plus className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="text-white font-semibold">Эмиссия</p>
                <p className="text-slate-400 text-sm">Создать AC</p>
              </div>
            </button>

            <button onClick={() => setShowSendModal(true)} className="flex items-center gap-3 p-5 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 hover:border-green-500/50 transition-all group">
              <Send className="w-8 h-8 text-green-400 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="text-white font-semibold">Перевод</p>
                <p className="text-slate-400 text-sm">Из казны</p>
              </div>
            </button>

            <button onClick={handleDistributeDividends} disabled={distributingDividends || collectedFees <= 0} className="flex items-center gap-3 p-5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-500/30 hover:border-cyan-500/50 transition-all group disabled:opacity-50">
              {distributingDividends ? <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div> : <Gift className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform" />}
              <div className="text-left">
                <p className="text-white font-semibold">Дивиденды</p>
                <p className="text-slate-400 text-sm">{formatNumber(collectedFees)} AC</p>
              </div>
            </button>

            <button onClick={() => setShowBonusModal(true)} className="flex items-center gap-3 p-5 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-600/20 border border-pink-500/30 hover:border-pink-500/50 transition-all group">
              <Gift className="w-8 h-8 text-pink-400 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="text-white font-semibold">Welcome Bonus</p>
                <p className="text-slate-400 text-sm">100 AC</p>
              </div>
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Транзакций сегодня</p>
                <p className="text-2xl font-bold text-white">{stats.transactions_today}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Кошельков с AC</p>
                <p className="text-2xl font-bold text-white">{stats.wallets_with_coins}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Welcome бонусов</p>
                <p className="text-2xl font-bold text-white">{stats.welcome_bonuses_given}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-slate-400 text-sm">Отменено TX</p>
                <p className="text-2xl font-bold text-white">{stats.reversed_transactions}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Master Wallet Tab */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl p-6 border border-green-500/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Building className="w-9 h-9 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Master Wallet</h2>
                  <p className="text-slate-400">Казначейство платформы</p>
                </div>
              </div>
              <button onClick={() => setShowSendModal(true)} className="px-6 py-3 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-2">
                <Send className="w-5 h-5" />
                Перевести
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-900/50 rounded-xl p-6">
                <p className="text-slate-400 mb-2">ALTYN COIN (AC)</p>
                <p className="text-4xl font-bold text-white">{treasuryBalance.toLocaleString()}</p>
              </div>
              <div className="bg-slate-900/50 rounded-xl p-6">
                <p className="text-slate-400 mb-2">ALTYN TOKEN (AT)</p>
                <p className="text-4xl font-bold text-white">{(masterWallet?.treasury?.token_balance || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setShowEmissionModal(true)} className="p-6 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-all">
              <Plus className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-white font-semibold">Новая эмиссия</p>
              <p className="text-slate-400 text-sm">Добавить AC в казну</p>
            </button>
            <button onClick={() => setShowBonusModal(true)} className="p-6 rounded-xl bg-pink-500/20 border border-pink-500/30 hover:border-pink-500/50 transition-all">
              <Gift className="w-8 h-8 text-pink-400 mb-2" />
              <p className="text-white font-semibold">Welcome Bonus</p>
              <p className="text-slate-400 text-sm">Выдать новому пользователю</p>
            </button>
          </div>

          {/* Recent Treasury Transactions */}
          {masterWallet?.recent_transactions?.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="text-white font-medium">Последние операции казначейства</h3>
              </div>
              <div className="divide-y divide-slate-700/50 max-h-80 overflow-y-auto">
                {masterWallet.recent_transactions.map((tx, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-700/30 cursor-pointer" onClick={() => setSelectedTx(tx.code || tx.id)}>
                    <div className="flex items-center gap-3">
                      {tx.from_user_id === 'PLATFORM_TREASURY' ? (
                        <ArrowUpRight className="w-5 h-5 text-red-400" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-green-400" />
                      )}
                      <div>
                        <p className="text-white font-medium">
                          {tx.from_user_id === 'PLATFORM_TREASURY' ? tx.to_user_name : tx.from_user_name}
                        </p>
                        <p className="text-slate-500 text-sm">{txTypeLabels[tx.transaction_type] || tx.transaction_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.from_user_id === 'PLATFORM_TREASURY' ? 'text-red-400' : 'text-green-400'}`}>
                        {tx.from_user_id === 'PLATFORM_TREASURY' ? '-' : '+'}{tx.amount?.toLocaleString()} AC
                      </p>
                      <p className="text-slate-500 text-xs font-mono">{tx.code || tx.id?.slice(0, 8)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tokens Tab */}
      {activeTab === 'tokens' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <p className="text-slate-400 text-sm">Общий объем</p>
              <p className="text-3xl font-bold text-white mt-2">{formatNumber(totalTokens)}</p>
              <p className="text-slate-500 text-xs mt-1">ALTYN TOKEN (AT)</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <p className="text-slate-400 text-sm">Распределено</p>
              <p className="text-3xl font-bold text-purple-400 mt-2">{formatNumber(distributedTokens)}</p>
              <p className="text-slate-500 text-xs mt-1">{((distributedTokens / totalTokens) * 100).toFixed(4)}%</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <p className="text-slate-400 text-sm">Держателей</p>
              <p className="text-3xl font-bold text-cyan-400 mt-2">{tokenHolders.length}</p>
              <p className="text-slate-500 text-xs mt-1">активных</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Users className="w-5 h-5" />
                Держатели ALTYN TOKEN
              </h3>
              <button onClick={() => setShowInitModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Выдать токены
              </button>
            </div>
            <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
              {tokenHolders.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Нет держателей токенов</div>
              ) : (
                tokenHolders.map((holder, idx) => (
                  <TokenHolderRow key={holder.user_id} holder={holder} rank={idx + 1} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Search */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => { setTxSearch(e.target.value); setTxPage(0); }}
                placeholder="Поиск по коду транзакции..."
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button onClick={fetchTransactions} className="px-4 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Transactions List */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Код</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Тип</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">От</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Кому</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Сумма</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Дата</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-12 text-center text-slate-400">Транзакции не найдены</td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-cyan-400 text-sm">{tx.code || tx.id?.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs bg-slate-700 text-slate-300">
                            {txTypeLabels[tx.transaction_type] || tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white text-sm">{tx.from_user_name}</td>
                        <td className="px-4 py-3 text-white text-sm">{tx.to_user_name}</td>
                        <td className="px-4 py-3 text-right text-white font-semibold">{tx.amount?.toLocaleString()} {tx.asset_type === 'COIN' ? 'AC' : 'AT'}</td>
                        <td className="px-4 py-3">
                          {tx.is_reversed ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">Отменена</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">OK</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-sm">{new Date(tx.created_at).toLocaleDateString('ru-RU')}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedTx(tx.code || tx.id)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showSendModal && <SendFromTreasuryModal onClose={() => setShowSendModal(false)} onSuccess={(data) => { showNotification('success', `Отправлено ${data.transaction.amount} AC (${data.transaction.code})`); fetchData(); }} />}
      {showEmissionModal && <EmissionModal onClose={() => setShowEmissionModal(false)} onSuccess={() => { showNotification('success', 'Эмиссия создана'); fetchData(); }} />}
      {showInitModal && <InitializeTokensModal onClose={() => setShowInitModal(false)} onSuccess={() => { showNotification('success', 'Токены выданы'); fetchData(); }} />}
      {showBonusModal && <WelcomeBonusModal onClose={() => setShowBonusModal(false)} onSuccess={() => { showNotification('success', 'Бонус выдан'); fetchData(); }} />}
      {selectedTx && <TransactionDetailModal txCode={selectedTx} onClose={() => setSelectedTx(null)} onReverse={() => { showNotification('success', 'Транзакция отменена'); fetchTransactions(); fetchData(); }} />}
    </div>
  );
};

export default AdminAltynManagement;
