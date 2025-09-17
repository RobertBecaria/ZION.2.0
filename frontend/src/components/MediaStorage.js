import React, { useState, useEffect } from 'react';
import { 
  Image, FileText, Video, Filter, Grid, List, Upload, 
  FolderPlus, Download, Trash2, Search, Calendar
} from 'lucide-react';

const MediaStorage = ({ 
  mediaType = 'photos', // 'photos', 'documents', 'videos'
  user,
  activeModule = 'personal',
  moduleColor = '#059669',
  selectedModuleFilter = 'all',
  onModuleFilterChange
}) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list'
  const [searchTerm, setSearchTerm] = useState('');
  
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  // Module configuration with colors
  const modules = {
    all: { name: 'Все', color: '#6B7280' },
    family: { name: 'Семья', color: '#059669' },
    work: { name: 'Работа', color: '#2563EB' },
    education: { name: 'Образование', color: '#7C3AED' },
    health: { name: 'Здоровье', color: '#DC2626' },
    government: { name: 'Госуслуги', color: '#EA580C' },
    business: { name: 'Бизнес', color: '#CA8A04' },
    community: { name: 'Сообщество', color: '#4B5563' },
    personal: { name: 'Личное', color: '#10B981' }
  };

  // Fetch media files
  const fetchMedia = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const params = new URLSearchParams();
      
      // Convert mediaType to backend format
      const fileType = mediaType === 'photos' ? 'image' : 
                      mediaType === 'documents' ? 'document' : 
                      mediaType === 'videos' ? 'video' : null;
      
      if (fileType) params.append('media_type', fileType);
      if (selectedModuleFilter !== 'all') params.append('source_module', selectedModuleFilter);
      
      const response = await fetch(`${backendUrl}/api/media?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMediaFiles(data.media_files || []);
      } else {
        console.error('Failed to fetch media files');
        setMediaFiles([]);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      setMediaFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [mediaType, selectedModuleFilter]);

  // Filter files by search term
  const filteredFiles = mediaFiles.filter(file =>
    file.original_filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group files by date
  const groupedFiles = filteredFiles.reduce((groups, file) => {
    const date = new Date(file.created_at).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(file);
    return groups;
  }, {});

  const getMediaIcon = (type) => {
    switch(type) {
      case 'photos': return <Image size={24} />;
      case 'documents': return <FileText size={24} />;
      case 'videos': return <Video size={24} />;
      default: return <FileText size={24} />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="media-storage">
      {/* Header */}
      <div className="media-storage-header">
        <div className="header-left">
          <div className="media-type-icon" style={{ color: moduleColor }}>
            {getMediaIcon(mediaType)}
          </div>
          <div className="header-info">
            <h2>
              {mediaType === 'photos' && 'Мои Фото'}
              {mediaType === 'documents' && 'Мои Документы'}
              {mediaType === 'videos' && 'Мои Видео'}
            </h2>
            <p>{filteredFiles.length} файлов</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button className="action-btn primary">
            <Upload size={18} />
            Загрузить
          </button>
          <button className="action-btn">
            <FolderPlus size={18} />
            Альбом
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="media-controls">
        <div className="controls-left">
          <span className="active-filter">
            Показано: <strong>{modules[selectedModuleFilter]?.name || 'Все'}</strong>
          </span>
        </div>

        <div className="controls-right">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Поиск файлов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="view-controls">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={18} />
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Media Content */}
      <div className="media-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Загрузка файлов...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ color: moduleColor }}>
              {getMediaIcon(mediaType)}
            </div>
            <h3>Файлы не найдены</h3>
            <p>
              {selectedModuleFilter === 'all' 
                ? `У вас пока нет ${mediaType === 'photos' ? 'фотографий' : mediaType === 'documents' ? 'документов' : 'видео'}`
                : `Нет файлов в разделе "${modules[selectedModuleFilter]?.name}"`
              }
            </p>
            <button className="upload-btn" style={{ backgroundColor: moduleColor }}>
              <Upload size={18} />
              Загрузить файлы
            </button>
          </div>
        ) : (
          <div className={`media-grid ${viewMode}`}>
            {Object.entries(groupedFiles).map(([date, files]) => (
              <div key={date} className="date-group">
                <div className="date-header">
                  <Calendar size={16} />
                  <span>{date}</span>
                  <span className="file-count">({files.length})</span>
                </div>
                
                <div className={`files-grid ${viewMode}`}>
                  {files.map((file) => (
                    <div key={file.id} className="media-item" data-module={file.source_module}>
                      {file.file_type === 'image' ? (
                        <div className="media-preview">
                          <img 
                            src={`${backendUrl}${file.file_url}`} 
                            alt={file.original_filename}
                            loading="lazy"
                          />
                          <div 
                            className="module-badge" 
                            style={{ backgroundColor: modules[file.source_module]?.color || '#6B7280' }}
                          >
                            {modules[file.source_module]?.name || 'Unknown'}
                          </div>
                        </div>
                      ) : (
                        <div className="document-preview">
                          <FileText size={48} />
                          <div 
                            className="module-badge" 
                            style={{ backgroundColor: modules[file.source_module]?.color || '#6B7280' }}
                          >
                            {modules[file.source_module]?.name || 'Unknown'}
                          </div>
                        </div>
                      )}
                      
                      <div className="media-info">
                        <h4 className="filename">{file.original_filename}</h4>
                        <p className="file-meta">
                          {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      
                      <div className="media-actions">
                        <button className="action-btn-small" title="Скачать">
                          <Download size={16} />
                        </button>
                        <button className="action-btn-small danger" title="Удалить">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaStorage;