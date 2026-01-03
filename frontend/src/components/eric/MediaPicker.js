/**
 * Media Picker Component
 * Allows users to select photos/documents from their platform storage
 */
import React, { useState, useEffect } from 'react';
import { 
  X, Image, FileText, Search, Check, Loader2,
  FolderOpen, Calendar
} from 'lucide-react';

const MediaPicker = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  mediaType = 'all', // 'all', 'photos', 'documents'
  multiple = false,
  title = 'Выберите файл'
}) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'photos', 'documents'

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
      setSelectedFiles([]);
    }
  }, [isOpen, activeFilter]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const params = new URLSearchParams();
      
      // Determine file type filter
      let fileType = null;
      if (mediaType === 'photos' || activeFilter === 'photos') {
        fileType = 'image';
      } else if (mediaType === 'documents' || activeFilter === 'documents') {
        fileType = 'document';
      }
      
      if (fileType) {
        params.append('media_type', fileType);
      }
      params.append('limit', '100');

      const response = await fetch(`${BACKEND_URL}/api/media?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMediaFiles(data.media_files || []);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFileSelection = (file) => {
    if (multiple) {
      setSelectedFiles(prev => {
        const isSelected = prev.some(f => f.id === file.id);
        if (isSelected) {
          return prev.filter(f => f.id !== file.id);
        }
        return [...prev, file];
      });
    } else {
      setSelectedFiles([file]);
    }
  };

  const handleConfirm = () => {
    if (selectedFiles.length > 0) {
      onSelect(multiple ? selectedFiles : selectedFiles[0]);
      onClose();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (file) => {
    if (file.file_type === 'image') {
      return <Image size={20} className="text-blue-500" />;
    }
    return <FileText size={20} className="text-orange-500" />;
  };

  const filteredFiles = mediaFiles.filter(file => {
    if (!searchTerm) return true;
    const fileName = file.original_filename || file.filename || '';
    return fileName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <div className="media-picker-overlay" onClick={onClose}>
      <div className="media-picker-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="media-picker-header">
          <h3>{title}</h3>
          <button className="media-picker-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        {mediaType === 'all' && (
          <div className="media-picker-filters">
            <button 
              className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              <FolderOpen size={16} />
              Все
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'photos' ? 'active' : ''}`}
              onClick={() => setActiveFilter('photos')}
            >
              <Image size={16} />
              Фото
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'documents' ? 'active' : ''}`}
              onClick={() => setActiveFilter('documents')}
            >
              <FileText size={16} />
              Документы
            </button>
          </div>
        )}

        {/* Search */}
        <div className="media-picker-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Поиск файлов..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Content */}
        <div className="media-picker-content">
          {loading ? (
            <div className="media-picker-loading">
              <Loader2 size={32} className="spin" />
              <p>Загрузка файлов...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="media-picker-empty">
              <FolderOpen size={48} />
              <p>Файлы не найдены</p>
              <span>Загрузите файлы в разделе "Мои Фото" или "Мои Документы"</span>
            </div>
          ) : (
            <div className="media-picker-grid">
              {filteredFiles.map(file => (
                <div 
                  key={file.id}
                  className={`media-picker-item ${selectedFiles.some(f => f.id === file.id) ? 'selected' : ''}`}
                  onClick={() => toggleFileSelection(file)}
                >
                  {file.file_type === 'image' ? (
                    <img 
                      src={`${BACKEND_URL}${file.file_url || `/api/media/${file.id}`}`} 
                      alt={file.original_filename}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/placeholder-image.png';
                      }}
                    />
                  ) : (
                    <div className="document-preview">
                      {getFileIcon(file)}
                      <span>{file.original_filename?.split('.').pop()?.toUpperCase() || 'DOC'}</span>
                    </div>
                  )}
                  
                  <div className="media-item-info">
                    <span className="media-item-name">{file.original_filename || 'Без названия'}</span>
                    <span className="media-item-meta">
                      {formatDate(file.created_at)} • {formatFileSize(file.file_size)}
                    </span>
                  </div>

                  {selectedFiles.some(f => f.id === file.id) && (
                    <div className="media-item-check">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="media-picker-footer">
          <span className="selected-count">
            {selectedFiles.length > 0 
              ? `Выбрано: ${selectedFiles.length}` 
              : 'Выберите файл'}
          </span>
          <div className="footer-actions">
            <button className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button 
              className="confirm-btn"
              onClick={handleConfirm}
              disabled={selectedFiles.length === 0}
            >
              Выбрать
            </button>
          </div>
        </div>
      </div>

      <style jsx="true">{`
        .media-picker-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .media-picker-modal {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 700px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .media-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .media-picker-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1c1e21;
        }

        .media-picker-close {
          background: none;
          border: none;
          padding: 8px;
          border-radius: 50%;
          cursor: pointer;
          color: #65676b;
          transition: all 0.2s;
        }

        .media-picker-close:hover {
          background: #f0f2f5;
          color: #1c1e21;
        }

        .media-picker-filters {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #f0f2f5;
          border: none;
          border-radius: 20px;
          font-size: 13px;
          color: #65676b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          background: #e4e6e9;
        }

        .filter-btn.active {
          background: linear-gradient(135deg, #FFD93D 0%, #FF9500 100%);
          color: #1c1e21;
        }

        .media-picker-search {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          border-bottom: 1px solid #e5e7eb;
          color: #65676b;
        }

        .media-picker-search input {
          flex: 1;
          border: none;
          font-size: 14px;
          outline: none;
          background: transparent;
        }

        .media-picker-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          min-height: 300px;
        }

        .media-picker-loading,
        .media-picker-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 250px;
          color: #9ca3af;
          text-align: center;
        }

        .media-picker-loading p,
        .media-picker-empty p {
          margin: 12px 0 4px;
          font-size: 15px;
          color: #65676b;
        }

        .media-picker-empty span {
          font-size: 13px;
        }

        .media-picker-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }

        .media-picker-item {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s;
          background: #f8f9fa;
        }

        .media-picker-item:hover {
          border-color: #FFD93D;
        }

        .media-picker-item.selected {
          border-color: #FF9500;
          box-shadow: 0 0 0 3px rgba(255, 149, 0, 0.2);
        }

        .media-picker-item img {
          width: 100%;
          height: 100px;
          object-fit: cover;
        }

        .document-preview {
          width: 100%;
          height: 100px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #f0f2f5;
        }

        .document-preview span {
          font-size: 11px;
          font-weight: 600;
          color: #65676b;
        }

        .media-item-info {
          padding: 8px;
        }

        .media-item-name {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #1c1e21;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .media-item-meta {
          display: block;
          font-size: 10px;
          color: #9ca3af;
          margin-top: 2px;
        }

        .media-item-check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          background: #FF9500;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .media-picker-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          background: #f8f9fa;
        }

        .selected-count {
          font-size: 14px;
          color: #65676b;
        }

        .footer-actions {
          display: flex;
          gap: 8px;
        }

        .cancel-btn {
          padding: 10px 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          color: #65676b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          background: #f0f2f5;
        }

        .confirm-btn {
          padding: 10px 20px;
          background: linear-gradient(135deg, #FFD93D 0%, #FF9500 100%);
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #1c1e21;
          cursor: pointer;
          transition: all 0.2s;
        }

        .confirm-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 149, 0, 0.3);
        }

        .confirm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 600px) {
          .media-picker-modal {
            width: 95%;
            max-height: 90vh;
          }

          .media-picker-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          }
        }
      `}</style>
    </div>
  );
};

export default MediaPicker;
