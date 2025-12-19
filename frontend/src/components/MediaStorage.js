import React, { useState, useEffect, useCallback } from 'react';
import { 
  Image, FileText, Video, Grid, List, Upload, 
  Download, Trash2, Search, Calendar, ZoomIn
} from 'lucide-react';
import { useLightbox } from '../hooks/useLightbox';
import LightboxModal from './LightboxModal';
import { triggerConfetti, toast } from '../utils/animations';

const MediaStorage = ({ 
  mediaType = 'photos', // 'photos', 'documents', 'videos'
  user,
  activeModule = 'personal',
  moduleColor = '#059669',
  selectedModuleFilter = 'all',
  onModuleFilterChange,
  onModuleCountsUpdate
}) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const backendUrl = process.env.REACT_APP_BACKEND_URL;
  
  // Use the shared lightbox hook
  const {
    lightboxImage,
    lightboxImages,
    lightboxIndex,
    openLightbox,
    closeLightbox,
    nextImage,
    prevImage
  } = useLightbox();

  // Module configuration with colors (matching the exact structure)
  const modules = {
    all: { name: 'Все', color: '#6B7280' },
    family: { name: 'Семья', color: '#059669' },
    news: { name: 'Новости', color: '#1D4ED8' },
    journal: { name: 'Журнал', color: '#6D28D9' },
    services: { name: 'Сервисы', color: '#B91C1C' },
    organizations: { name: 'Организации', color: '#C2410C' },
    marketplace: { name: 'Маркетплейс', color: '#BE185D' },
    finance: { name: 'Финансы', color: '#A16207' },
    events: { name: 'Мероприятия', color: '#7E22CE' }
  };

  // Frontend to Backend module mapping
  // Backend valid modules: ["family", "work", "education", "health", "government", "business", "community", "personal"]
  const frontendToBackendModuleMap = {
    'family': 'family',         // Family -> Family
    'news': 'community',        // News -> Community 
    'journal': 'personal',      // Journal -> Personal
    'services': 'business',     // Services -> Business
    'organizations': 'work',    // Organizations -> Work
    'marketplace': 'business',  // Marketplace -> Business
    'finance': 'business',      // Finance -> Business
    'events': 'community'       // Events -> Community
  };

  // Backend to Frontend module mapping (for display purposes)
  const backendToFrontendModuleMap = {
    'family': 'family',
    'community': 'news',        // Community -> News (first mapping)
    'personal': 'journal',      // Personal -> Journal (first mapping)
    'business': 'services',     // Business -> Services (first mapping)
    'work': 'organizations',    // Work -> Organizations
    'education': 'journal',     // Education -> Journal
    'health': 'journal',        // Health -> Journal
    'government': 'organizations' // Government -> Organizations
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
      // Always fetch all files and filter on frontend to handle multiple backend modules mapping to one frontend module
      
      const response = await fetch(`${backendUrl}/api/media?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMediaFiles(data.media_files || []);
        
        // Update module counts in parent
        if (onModuleCountsUpdate && data.media_files) {
          const updatedCounts = getModuleFileCountsFromData(data.media_files);
          onModuleCountsUpdate(updatedCounts);
        }
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

  // Handle file upload
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const token = localStorage.getItem('zion_token');
      const uploadedFiles = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const frontendModule = selectedModuleFilter === 'all' ? activeModule : selectedModuleFilter;
        const backendModule = getBackendModule(frontendModule);
        
        console.log(`Uploading file ${file.name} - Frontend module: ${frontendModule}, Backend module: ${backendModule}`);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_module', backendModule);
        formData.append('privacy_level', 'private');
        
        const response = await fetch(`${backendUrl}/api/media/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (response.ok) {
          const uploadedFile = await response.json();
          uploadedFiles.push(uploadedFile);
          setUploadProgress(((i + 1) / files.length) * 100);
        } else {
          console.error(`Failed to upload ${file.name}`);
        }
      }
      
      // Refresh media list after upload
      await fetchMedia();
      
      console.log(`Successfully uploaded ${uploadedFiles.length} files`);
      
      // 🎉 Trigger confetti celebration for successful uploads!
      if (uploadedFiles.length > 0) {
        triggerConfetti(document.body, {
          particleCount: uploadedFiles.length * 15, // More files = more confetti!
          colors: ['#10B981', '#059669', '#34D399', '#3B82F6', '#F59E0B', '#EC4899']
        });
        
        // Show success toast
        const fileType = mediaType === 'photos' ? 'фото' : 
                        mediaType === 'videos' ? 'видео' : 'файлов';
        toast.success(
          `Успешно загружено ${uploadedFiles.length} ${fileType}!`, 
          'Отлично!',
          { duration: 4000 }
        );
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      // Show error toast
      toast.error('Ошибка при загрузке файлов', 'Ошибка');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Get current filter color
  const getCurrentFilterColor = () => {
    if (selectedModuleFilter === 'all') {
      return moduleColor; // Use active module color when "all" is selected
    }
    return modules[selectedModuleFilter]?.color || moduleColor;
  };

  // Map frontend module to backend module
  const getBackendModule = (frontendModule) => {
    if (frontendModule === 'all') {
      // Map activeModule to backend if it exists in our mapping, otherwise use it directly
      return frontendToBackendModuleMap[activeModule] || activeModule;
    }
    return frontendToBackendModuleMap[frontendModule] || frontendModule;
  };

  // Get display module info from backend module name
  const getDisplayModuleInfo = (backendModuleName) => {
    // First try to find the frontend module that maps to this backend module
    const frontendModule = backendToFrontendModuleMap[backendModuleName] || backendModuleName;
    
    // Return the module info from the modules object
    return modules[frontendModule] || { name: 'Unknown', color: '#6B7280' };
  };

  // Calculate file counts for each module
  const getModuleFileCounts = () => {
    const counts = {};
    
    // Initialize all modules with 0 count
    Object.keys(modules).forEach(moduleKey => {
      if (moduleKey !== 'all') {
        counts[moduleKey] = 0;
      }
    });
    
    // Count files for each module
    mediaFiles.forEach(file => {
      const fileFrontendModule = backendToFrontendModuleMap[file.source_module] || file.source_module;
      if (counts.hasOwnProperty(fileFrontendModule)) {
        counts[fileFrontendModule]++;
      }
    });
    
    // Calculate total for 'all'
    counts['all'] = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    return counts;
  };

  // Calculate file counts for each module from data parameter
  const getModuleFileCountsFromData = (files) => {
    const counts = {};
    
    // Initialize all modules with 0 count
    Object.keys(modules).forEach(moduleKey => {
      if (moduleKey !== 'all') {
        counts[moduleKey] = 0;
      }
    });
    
    // Count files for each module
    files.forEach(file => {
      const fileFrontendModule = backendToFrontendModuleMap[file.source_module] || file.source_module;
      if (counts.hasOwnProperty(fileFrontendModule)) {
        counts[fileFrontendModule]++;
      }
    });
    
    // Calculate total for 'all'
    counts['all'] = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    return counts;
  };

  // Handle upload button click
  const handleUploadClick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    
    // Set accept attribute based on media type
    if (mediaType === 'photos') {
      fileInput.accept = 'image/jpeg,image/png,image/gif';
    } else if (mediaType === 'documents') {
      fileInput.accept = '.pdf,.doc,.docx,.ppt,.pptx';
    } else if (mediaType === 'videos') {
      fileInput.accept = 'video/mp4,video/webm,video/ogg';
    }
    
    fileInput.onchange = (e) => {
      const files = Array.from(e.target.files);
      handleFileUpload(files);
    };
    
    fileInput.click();
  };

  useEffect(() => {
    fetchMedia();
  }, [mediaType, selectedModuleFilter]);

  // Filter files by search term and selected module
  const filteredFiles = mediaFiles.filter(file => {
    // Filter by search term
    const matchesSearch = file.original_filename.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by selected module
    if (selectedModuleFilter === 'all') {
      return matchesSearch; // Show all files when "all" is selected
    }
    
    // Get the frontend module name that corresponds to this file's backend module
    const fileFrontendModule = backendToFrontendModuleMap[file.source_module] || file.source_module;
    const matchesModule = fileFrontendModule === selectedModuleFilter;
    
    return matchesSearch && matchesModule;
  });

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
          <button 
            className="action-btn primary" 
            style={{ 
              backgroundColor: getCurrentFilterColor(),
              borderColor: getCurrentFilterColor()
            }}
            onClick={handleUploadClick}
            disabled={uploading}
          >
            <Upload size={18} />
            {uploading ? 'Загружаем...' : 'Загрузить'}
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

      {/* Upload Progress */}
      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${uploadProgress}%`,
                backgroundColor: getCurrentFilterColor()
              }}
            ></div>
          </div>
          <span className="progress-text">Загрузка файлов... {Math.round(uploadProgress)}%</span>
        </div>
      )}

      {/* Media Content */}
      <div className="media-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Загрузка файлов...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ color: getCurrentFilterColor() }}>
              {getMediaIcon(mediaType)}
            </div>
            <h3>Файлы не найдены</h3>
            <p>
              {selectedModuleFilter === 'all' 
                ? `У вас пока нет ${mediaType === 'photos' ? 'фотографий' : mediaType === 'documents' ? 'документов' : 'видео'}`
                : `Нет файлов в разделе "${modules[selectedModuleFilter]?.name}"`
              }
            </p>
            <button 
              className="upload-btn" 
              style={{ backgroundColor: getCurrentFilterColor() }}
              onClick={handleUploadClick}
              disabled={uploading}
            >
              <Upload size={18} />
              {uploading ? 'Загружаем файлы...' : 'Загрузить файлы'}
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
                    <div 
                      key={file.id} 
                      className="media-item" 
                      data-module={file.source_module}
                      style={{ 
                        borderColor: getDisplayModuleInfo(file.source_module).color,
                        borderWidth: '2px'
                      }}
                    >
                      {file.file_type === 'image' ? (
                        <div 
                          className="media-preview image-container"
                          onClick={() => {
                            // Get all images from current view for navigation
                            const allImages = filteredFiles
                              .filter(f => f.file_type === 'image')
                              .map(f => `${backendUrl}${f.file_url}`);
                            const currentImageUrl = `${backendUrl}${file.file_url}`;
                            const imageIndex = allImages.indexOf(currentImageUrl);
                            openLightbox(currentImageUrl, allImages, imageIndex);
                          }}
                        >
                          <img 
                            src={`${backendUrl}${file.file_url}`} 
                            alt={file.original_filename}
                            loading="lazy"
                            className="clickable-image"
                          />
                          <div className="image-overlay">
                            <ZoomIn size={20} color="white" />
                          </div>
                          <div 
                            className="module-badge" 
                            style={{ backgroundColor: getDisplayModuleInfo(file.source_module).color }}
                          >
                            {getDisplayModuleInfo(file.source_module).name}
                          </div>
                        </div>
                      ) : (
                        <div className="document-preview">
                          <FileText size={48} />
                          <div 
                            className="module-badge" 
                            style={{ backgroundColor: getDisplayModuleInfo(file.source_module).color }}
                          >
                            {getDisplayModuleInfo(file.source_module).name}
                          </div>
                        </div>
                      )}
                      
                      <div className="media-info">
                        <h4 className="filename">{file.original_filename}</h4>
                        <p className="file-meta">
                          <span className="module-tag" style={{ color: getDisplayModuleInfo(file.source_module).color }}>
                            {getDisplayModuleInfo(file.source_module).name}
                          </span>
                          • {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      
                      <div className="media-actions">
                        <button 
                          className="action-btn-small" 
                          title="Скачать"
                          onClick={() => window.open(`${backendUrl}${file.file_url}`, '_blank')}
                        >
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
      
      {/* Lightbox Modal */}
      <LightboxModal
        lightboxImage={lightboxImage}
        lightboxImages={lightboxImages}
        lightboxIndex={lightboxIndex}
        closeLightbox={closeLightbox}
        nextImage={nextImage}
        prevImage={prevImage}
      />
    </div>
  );
};

export default MediaStorage;