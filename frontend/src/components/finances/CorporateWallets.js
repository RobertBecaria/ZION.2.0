/**
 * CorporateWallets Component
 * Displays and manages corporate wallets for organizations the user administers
 */
import React, { useState, useEffect } from 'react';
import { 
  Building2, Wallet, Coins, Plus, Send, ArrowUpRight, ArrowDownLeft,
  ChevronRight, RefreshCw, X, AlertCircle, CheckCircle, Users, Clock
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CorporateWallets = ({ user, moduleColor = '#A16207' }) => {
  const [corporateWallets, setCorporateWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgWallet, setOrgWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState(null);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState(false);
  
  const [transferForm, setTransferForm] = useState({
    transferType: 'user', // 'user' or 'organization'
    to_user_email: '',
    to_organization_id: '',
    amount: '',
    description: ''
  });

  const fetchCorporateWallets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${BACKEND_URL}/api/finance/corporate/wallets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCorporateWallets(data.corporate_wallets || []);
      }
    } catch (error) {
      console.error('Error fetching corporate wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgWalletDetails = async (orgId) => {
    try {
      const token = localStorage.getItem('zion_token');
      
      const [walletRes, txRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/finance/corporate/wallet/${orgId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${BACKEND_URL}/api/finance/corporate/transactions/${orgId}?limit=20`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (walletRes.ok) {
        const walletData = await walletRes.json();
        setOrgWallet(walletData.wallet);
      }
      
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching org wallet details:', error);
    }
  };

  const createCorporateWallet = async (orgId) => {
    try {
      setCreatingWallet(true);
      const token = localStorage.getItem('zion_token');
      
      const response = await fetch(`${BACKEND_URL}/api/finance/corporate-wallet?organization_id=${orgId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchCorporateWallets();
      }
    } catch (error) {
      console.error('Error creating corporate wallet:', error);
    } finally {
      setCreatingWallet(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setTransferLoading(true);
    setTransferError(null);
    
    try {
      const token = localStorage.getItem('zion_token');
      
      const payload = {
        organization_id: selectedOrg.organization_id,
        amount: parseFloat(transferForm.amount),
        description: transferForm.description || undefined
      };
      
      if (transferForm.transferType === 'user') {
        payload.to_user_email = transferForm.to_user_email;
      } else {
        payload.to_organization_id = transferForm.to_organization_id;
      }
      
      const response = await fetch(`${BACKEND_URL}/api/finance/corporate/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTransferSuccess(true);
        // Refresh wallet data
        await fetchOrgWalletDetails(selectedOrg.organization_id);
        await fetchCorporateWallets();
        
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferSuccess(false);
          setTransferForm({
            transferType: 'user',
            to_user_email: '',
            to_organization_id: '',
            amount: '',
            description: ''
          });
        }, 2000);
      } else {
        setTransferError(data.detail || 'Ошибка перевода');
      }
    } catch (error) {
      setTransferError('Ошибка подключения к серверу');
    } finally {
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    fetchCorporateWallets();
  }, []);

  useEffect(() => {
    if (selectedOrg && selectedOrg.has_wallet) {
      fetchOrgWalletDetails(selectedOrg.organization_id);
    }
  }, [selectedOrg]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="corporate-wallets-loading" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <RefreshCw size={32} className="spin" style={{ color: moduleColor }} />
        <p style={{ marginTop: '16px', color: '#64748b' }}>Загрузка корпоративных кошельков...</p>
      </div>
    );
  }

  // If viewing specific organization wallet
  if (selectedOrg && selectedOrg.has_wallet) {
    return (
      <div className="corporate-wallet-detail">
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <button 
            onClick={() => { setSelectedOrg(null); setOrgWallet(null); setTransactions([]); }}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#64748b',
              fontWeight: '500'
            }}
          >
            ← Назад
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {selectedOrg.organization_logo ? (
              <img src={selectedOrg.organization_logo} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
            ) : (
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '10px', 
                background: `${moduleColor}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building2 size={20} style={{ color: moduleColor }} />
              </div>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>{selectedOrg.organization_name}</h2>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Корпоративный кошелёк</span>
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div style={{
          background: `linear-gradient(135deg, ${moduleColor} 0%, ${moduleColor}CC 100%)`,
          borderRadius: '20px',
          padding: '24px',
          color: 'white',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', opacity: 0.9 }}>
            <Coins size={20} />
            <span style={{ fontSize: '14px' }}>Баланс ALTYN COIN</span>
          </div>
          <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '16px' }}>
            {formatNumber(orgWallet?.coin_balance || 0)} AC
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>
            ≈ ${formatNumber(orgWallet?.coin_balance || 0)} USD
          </div>
          
          {orgWallet?.is_admin && (
            <button
              onClick={() => setShowTransferModal(true)}
              style={{
                marginTop: '20px',
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '12px',
                padding: '12px 24px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Send size={18} />
              Перевести средства
            </button>
          )}
        </div>

        {/* Transaction History */}
        <div style={{ 
          background: 'white', 
          borderRadius: '16px', 
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>История операций</h3>
            <button 
              onClick={() => fetchOrgWalletDetails(selectedOrg.organization_id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          
          {transactions.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <Clock size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p>Нет операций</p>
            </div>
          ) : (
            <div>
              {transactions.map((tx, idx) => (
                <div 
                  key={tx.id || idx}
                  style={{
                    padding: '16px 20px',
                    borderBottom: idx < transactions.length - 1 ? '1px solid #f1f5f9' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: tx.type === 'outgoing' ? '#FEF2F2' : '#F0FDF4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {tx.type === 'outgoing' ? (
                        <ArrowUpRight size={20} style={{ color: '#DC2626' }} />
                      ) : (
                        <ArrowDownLeft size={20} style={{ color: '#16A34A' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: '500', color: '#1e293b' }}>
                        {tx.counterparty_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {tx.description || (tx.type === 'outgoing' ? 'Исходящий перевод' : 'Входящий перевод')}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontWeight: '600', 
                      color: tx.type === 'outgoing' ? '#DC2626' : '#16A34A' 
                    }}>
                      {tx.type === 'outgoing' ? '-' : '+'}{formatNumber(tx.amount)} AC
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {formatDate(tx.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transfer Modal */}
        {showTransferModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '440px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Send size={24} style={{ color: moduleColor }} />
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Перевод средств</h3>
                </div>
                <button onClick={() => {
                  setShowTransferModal(false);
                  setTransferError(null);
                  setTransferSuccess(false);
                }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={20} style={{ color: '#64748b' }} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px' }}>
                {transferSuccess ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CheckCircle size={64} style={{ color: '#10B981', marginBottom: '16px' }} />
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Перевод выполнен!</h4>
                    <p style={{ color: '#64748b' }}>Средства успешно переведены</p>
                  </div>
                ) : (
                  <form onSubmit={handleTransfer}>
                    {transferError && (
                      <div style={{
                        padding: '12px 16px',
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '10px',
                        color: '#DC2626',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <AlertCircle size={18} />
                        {transferError}
                      </div>
                    )}

                    {/* Transfer Type */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                        Тип перевода
                      </label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setTransferForm({ ...transferForm, transferType: 'user' })}
                          style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '10px',
                            border: `2px solid ${transferForm.transferType === 'user' ? moduleColor : '#e2e8f0'}`,
                            background: transferForm.transferType === 'user' ? `${moduleColor}10` : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            color: transferForm.transferType === 'user' ? moduleColor : '#64748b'
                          }}
                        >
                          <Users size={18} />
                          Пользователю
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransferForm({ ...transferForm, transferType: 'organization' })}
                          style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '10px',
                            border: `2px solid ${transferForm.transferType === 'organization' ? moduleColor : '#e2e8f0'}`,
                            background: transferForm.transferType === 'organization' ? `${moduleColor}10` : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            color: transferForm.transferType === 'organization' ? moduleColor : '#64748b'
                          }}
                        >
                          <Building2 size={18} />
                          Организации
                        </button>
                      </div>
                    </div>

                    {/* Recipient */}
                    {transferForm.transferType === 'user' ? (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                          Email получателя *
                        </label>
                        <input
                          type="email"
                          value={transferForm.to_user_email}
                          onChange={(e) => setTransferForm({ ...transferForm, to_user_email: e.target.value })}
                          placeholder="user@example.com"
                          required
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '15px'
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                          ID организации *
                        </label>
                        <input
                          type="text"
                          value={transferForm.to_organization_id}
                          onChange={(e) => setTransferForm({ ...transferForm, to_organization_id: e.target.value })}
                          placeholder="Organization ID"
                          required
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '15px'
                          }}
                        />
                      </div>
                    )}

                    {/* Amount */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                        Сумма (AC) *
                      </label>
                      <input
                        type="number"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                        placeholder="0.00"
                        min="0.01"
                        step="0.01"
                        required
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: '15px'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px', color: '#64748b' }}>
                        <span>Комиссия: 0.1%</span>
                        <span>Доступно: {formatNumber(orgWallet?.coin_balance)} AC</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                        Описание
                      </label>
                      <input
                        type="text"
                        value={transferForm.description}
                        onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                        placeholder="Назначение платежа..."
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: '15px'
                        }}
                      />
                    </div>

                    {/* Submit */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setShowTransferModal(false)}
                        style={{
                          flex: 1,
                          padding: '14px',
                          borderRadius: '10px',
                          border: 'none',
                          background: '#f1f5f9',
                          color: '#64748b',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={transferLoading}
                        style={{
                          flex: 1,
                          padding: '14px',
                          borderRadius: '10px',
                          border: 'none',
                          background: moduleColor,
                          color: 'white',
                          fontWeight: '600',
                          cursor: transferLoading ? 'not-allowed' : 'pointer',
                          opacity: transferLoading ? 0.7 : 1
                        }}
                      >
                        {transferLoading ? 'Перевод...' : 'Перевести'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main list view
  return (
    <div className="corporate-wallets">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>
          Корпоративные кошельки
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Управление финансами организаций, в которых вы являетесь администратором
        </p>
      </div>

      {corporateWallets.length === 0 ? (
        <div style={{
          background: '#f8fafc',
          borderRadius: '16px',
          padding: '60px 20px',
          textAlign: 'center'
        }}>
          <Building2 size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#64748b' }}>Нет доступных организаций</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            Вы должны быть администратором организации, чтобы управлять её корпоративным кошельком
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {corporateWallets.map((org) => (
            <div
              key={org.organization_id}
              style={{
                background: 'white',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: org.has_wallet ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
              onClick={() => org.has_wallet && setSelectedOrg(org)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {org.organization_logo ? (
                  <img src={org.organization_logo} alt="" style={{ width: '50px', height: '50px', borderRadius: '12px' }} />
                ) : (
                  <div style={{ 
                    width: '50px', 
                    height: '50px', 
                    borderRadius: '12px', 
                    background: `${moduleColor}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Building2 size={24} style={{ color: moduleColor }} />
                  </div>
                )}
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
                    {org.organization_name}
                  </h3>
                  {org.has_wallet ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Coins size={14} style={{ color: moduleColor }} />
                      <span style={{ fontSize: '15px', fontWeight: '600', color: moduleColor }}>
                        {formatNumber(org.wallet?.coin_balance)} AC
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      Кошелёк не создан
                    </span>
                  )}
                </div>
              </div>
              
              {org.has_wallet ? (
                <ChevronRight size={20} style={{ color: '#94a3b8' }} />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    createCorporateWallet(org.organization_id);
                  }}
                  disabled={creatingWallet}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: moduleColor,
                    color: 'white',
                    fontWeight: '600',
                    cursor: creatingWallet ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px'
                  }}
                >
                  <Plus size={16} />
                  Создать кошелёк
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CorporateWallets;
