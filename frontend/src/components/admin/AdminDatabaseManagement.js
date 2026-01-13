import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, HardDrive, Download, Upload, RefreshCw, CheckCircle,
  AlertTriangle, Clock, FileJson, Layers, Archive, History,
  ChevronDown, ChevronUp, X
} from 'lucide-react';

// Get backend URL - smart detection for both preview and production
const getBackendUrl = () => {
  // First try environment variable
  let baseUrl = process.env.REACT_APP_BACKEND_URL || '';
  
  // If running on production domain but env var points to preview, use current origin
  const currentHost = window.location.hostname;
  const isProduction = currentHost === 'zioncity.app' || 
                       currentHost.endsWith('.zioncity.app') ||
                       currentHost.endsWith('.emergent.host');
  
  // If baseUrl is empty or points to preview while we're on production, use current origin
  if (!baseUrl || (isProduction && baseUrl.includes('preview.emergentagent.com'))) {
    baseUrl = window.location.origin;
  }
  
  // Ensure we have /api suffix
  if (baseUrl.endsWith('/api')) {
    return baseUrl;
  }
  return baseUrl + '/api';
};

const BACKEND_URL = getBackendUrl();

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
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

const CollectionRow = ({ collection, expanded, onToggle }) => (
  <div className="border-b border-slate-700/50 last:border-0">
    <div
      className="flex items-center justify-between p-4 hover:bg-slate-700/30 cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <Layers className="w-5 h-5 text-purple-400" />
        <span className="text-white font-medium">{collection.name}</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-white">{collection.document_count.toLocaleString()}</p>
          <p className="text-slate-500 text-xs">документов</p>
        </div>
        <div className="text-right">
          <p className="text-slate-300">{formatBytes(collection.size_bytes)}</p>
          <p className="text-slate-500 text-xs">размер</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </div>
    </div>
    {expanded && (
      <div className="px-4 pb-4 bg-slate-900/30">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Размер хранилища</p>
            <p className="text-white">{formatBytes(collection.storage_size_bytes || 0)}</p>
          </div>
          <div>
            <p className="text-slate-500">Индексов</p>
            <p className="text-white">{collection.index_count || 0}</p>
          </div>
          <div>
            <p className="text-slate-500">Размер индексов</p>
            <p className="text-white">{formatBytes(collection.index_size_bytes || 0)}</p>
          </div>
        </div>
      </div>
    )}
  </div>
);

const RestoreModal = ({ onClose, onRestore }) => {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('merge');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setError('');
    setFile(selectedFile);

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      if (!data.metadata || !data.collections) {
        setError('Неверный формат файла резервной копии');
        setPreview(null);
        return;
      }

      setPreview({
        date: data.metadata.created_at,
        version: data.metadata.version,
        database: data.metadata.database_name,
        collections: Object.keys(data.collections).length,
        documents: Object.values(data.collections).reduce(
          (sum, c) => sum + (c.document_count || 0), 0
        )
      });
    } catch (err) {
      setError('Ошибка чтения файла: ' + err.message);
      setPreview(null);
    }
  };

  const handleRestore = async () => {
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await onRestore(data, mode);
      onClose();
    } catch (err) {
      setError('Ошибка восстановления: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload className="w-6 h-6 text-cyan-400" />
            Восстановление базы данных
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Файл резервной копии (.json)</label>
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-purple-500/50 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="backup-file"
              />
              <label htmlFor="backup-file" className="cursor-pointer">
                <FileJson className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300">
                  {file ? file.name : 'Нажмите для выбора файла'}
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  {file ? formatBytes(file.size) : 'или перетащите сюда'}
                </p>
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-2">
              <h4 className="text-white font-medium mb-3">Информация о резервной копии</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Дата создания</p>
                  <p className="text-white">{new Date(preview.date).toLocaleString('ru-RU')}</p>
                </div>
                <div>
                  <p className="text-slate-500">База данных</p>
                  <p className="text-white">{preview.database}</p>
                </div>
                <div>
                  <p className="text-slate-500">Коллекций</p>
                  <p className="text-white">{preview.collections}</p>
                </div>
                <div>
                  <p className="text-slate-500">Документов</p>
                  <p className="text-white">{preview.documents.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Restore Mode */}
          <div>
            <label className="block text-sm text-slate-400 mb-3">Режим восстановления</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 cursor-pointer hover:bg-slate-900/70 transition-colors">
                <input
                  type="radio"
                  name="mode"
                  value="merge"
                  checked={mode === 'merge'}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-4 h-4 text-purple-500"
                />
                <div>
                  <p className="text-white font-medium">Слияние (Merge)</p>
                  <p className="text-slate-500 text-sm">Добавить новые данные, обновить существующие</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 cursor-pointer hover:bg-slate-900/70 transition-colors">
                <input
                  type="radio"
                  name="mode"
                  value="replace"
                  checked={mode === 'replace'}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-4 h-4 text-purple-500"
                />
                <div>
                  <p className="text-white font-medium">Замена (Replace)</p>
                  <p className="text-slate-500 text-sm">Удалить все данные и заменить на резервную копию</p>
                </div>
              </label>
            </div>
          </div>

          {mode === 'replace' && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium">Внимание!</p>
                <p className="text-amber-400/80 text-sm">Режим замены удалит все текущие данные. Это действие нельзя отменить.</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleRestore}
            disabled={!file || !preview || loading}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Восстановление...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Восстановить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminDatabaseManagement = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedCollection, setExpandedCollection] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${BACKEND_URL}/admin/database/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Ошибка загрузки');
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${BACKEND_URL}/admin/database/backup-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Ошибка загрузки истории');
      const data = await response.json();
      setHistory(data.history);
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  }, [fetchStatus]);

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      setError('');
      const token = localStorage.getItem('admin_token');
      
      // Use AbortController for timeout (2 minutes)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      const response = await fetch(`${BACKEND_URL}/admin/database/backup`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка ${response.status}: ${errorText || 'Не удалось создать резервную копию'}`);
      }
      
      const data = await response.json();
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refresh status and history
      fetchStatus();
      fetchHistory();
      
      alert(`Резервная копия создана успешно!\nРазмер: ${formatBytes(data.size_bytes)}\nКоллекций: ${data.collections_count}`);
    } catch (err) {
      console.error('Backup error:', err);
      if (err.name === 'AbortError') {
        setError('Превышено время ожидания. База данных слишком большая для экспорта.');
        alert('Ошибка: Превышено время ожидания (2 минуты). Попробуйте позже или обратитесь к администратору.');
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setError('Ошибка сети. Проверьте подключение к интернету и попробуйте снова.');
        alert('Ошибка сети: Не удалось подключиться к серверу. Проверьте:\n1. Подключение к интернету\n2. Доступность сервера\n3. Попробуйте обновить страницу');
      } else {
        setError(err.message);
        alert('Ошибка: ' + err.message);
      }
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (backupData, mode) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${BACKEND_URL}/admin/database/restore?mode=${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(backupData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ошибка восстановления');
      }
      
      const data = await response.json();
      
      // Refresh status and history
      fetchStatus();
      fetchHistory();
      
      alert(`${data.message}\nВосстановлено документов: ${data.results.total_documents_restored}`);
    } catch (err) {
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-4">Загрузка статуса базы данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchStatus} className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">База данных</h1>
          <p className="text-slate-400">Управление и резервное копирование MongoDB</p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Название БД"
          value={status.database_name}
          icon={Database}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
        <StatCard
          title="Размер данных"
          value={formatBytes(status.total_size_bytes)}
          icon={HardDrive}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          subtitle={`Хранилище: ${formatBytes(status.storage_size_bytes)}`}
        />
        <StatCard
          title="Коллекций"
          value={status.total_collections}
          icon={Layers}
          color="bg-gradient-to-br from-cyan-500 to-cyan-600"
          subtitle={`${status.total_documents.toLocaleString()} документов`}
        />
        <StatCard
          title="Индексы"
          value={formatBytes(status.index_size_bytes)}
          icon={Archive}
          color="bg-gradient-to-br from-amber-500 to-amber-600"
        />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleBackup}
          disabled={backupLoading}
          className="flex items-center justify-center gap-3 p-6 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 hover:border-green-500/50 transition-all group"
        >
          {backupLoading ? (
            <div className="w-8 h-8 border-3 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
          ) : (
            <Download className="w-8 h-8 text-green-400 group-hover:scale-110 transition-transform" />
          )}
          <div className="text-left">
            <p className="text-white font-semibold text-lg">Создать резервную копию</p>
            <p className="text-slate-400 text-sm">Скачать JSON-файл со всеми данными</p>
          </div>
        </button>

        <button
          onClick={() => setShowRestoreModal(true)}
          className="flex items-center justify-center gap-3 p-6 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 hover:border-cyan-500/50 transition-all group"
        >
          <Upload className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <p className="text-white font-semibold text-lg">Восстановить из копии</p>
            <p className="text-slate-400 text-sm">Загрузить данные из JSON-файла</p>
          </div>
        </button>
      </div>

      {/* Last Backup Info */}
      {status.last_backup && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-white font-medium">Последняя резервная копия</p>
              <p className="text-slate-400 text-sm">
                {new Date(status.last_backup.timestamp).toLocaleString('ru-RU')} • 
                {formatBytes(status.last_backup.size_bytes)} • 
                {status.last_backup.collections_count} коллекций
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
          >
            <History className="w-4 h-4" />
            История
          </button>
        </div>
      )}

      {/* Backup History */}
      {showHistory && history.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700/50">
            <h3 className="text-white font-medium flex items-center gap-2">
              <History className="w-5 h-5" />
              История операций
            </h3>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-64 overflow-y-auto">
            {history.map((item, index) => (
              <div key={index} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {item.type === 'restore' ? (
                    <Upload className="w-5 h-5 text-cyan-400" />
                  ) : (
                    <Download className="w-5 h-5 text-green-400" />
                  )}
                  <div>
                    <p className="text-white">{item.type === 'restore' ? 'Восстановление' : 'Резервная копия'}</p>
                    <p className="text-slate-500 text-sm">
                      {new Date(item.created_at).toLocaleString('ru-RU')} • {item.created_by}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-slate-300">{item.collections_count} коллекций</p>
                  <p className="text-slate-500 text-sm">{item.document_count?.toLocaleString()} документов</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collections List */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Коллекции ({status.collections.length})
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {status.collections.map((collection) => (
            <CollectionRow
              key={collection.name}
              collection={collection}
              expanded={expandedCollection === collection.name}
              onToggle={() => setExpandedCollection(
                expandedCollection === collection.name ? null : collection.name
              )}
            />
          ))}
        </div>
      </div>

      {/* Restore Modal */}
      {showRestoreModal && (
        <RestoreModal
          onClose={() => setShowRestoreModal(false)}
          onRestore={handleRestore}
        />
      )}
    </div>
  );
};

export default AdminDatabaseManagement;
