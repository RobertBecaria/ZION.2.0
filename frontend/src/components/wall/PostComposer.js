import React, { useRef, useState } from 'react';
import { User, Image, Paperclip, X, Share2, FileText, Sparkles } from 'lucide-react';
import { extractYouTubeIdFromText, extractUrl, getFileGradient, moduleMapping } from './utils/postUtils';
import { triggerConfetti, toast } from '../../utils/animations';

function PostComposer({ 
  user, 
  moduleColor, 
  moduleName,
  backendUrl,
  onPostCreated 
}) {
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedMediaIds, setUploadedMediaIds] = useState([]);
  const [postVisibility, setPostVisibility] = useState('FAMILY_ONLY');
  const [detectedYouTube, setDetectedYouTube] = useState(null);
  const [detectedLink, setDetectedLink] = useState(null);
  const [linkPreview, setLinkPreview] = useState(null);
  const [loadingLinkPreview, setLoadingLinkPreview] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch link preview (simple client-side approach)
  const fetchLinkPreview = async (url) => {
    setLoadingLinkPreview(true);
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      setLinkPreview({ url, domain, title: domain, description: url });
    } catch (error) {
      console.log('Link preview error:', error);
      setLinkPreview(null);
    } finally {
      setLoadingLinkPreview(false);
    }
  };

  // Handle text change with URL detection
  const handlePostTextChange = (e) => {
    const text = e.target.value;
    setNewPost(text);
    
    // Detect YouTube
    const youtubeId = extractYouTubeIdFromText(text);
    if (youtubeId && youtubeId !== detectedYouTube) {
      setDetectedYouTube(youtubeId);
      setDetectedLink(null);
      setLinkPreview(null);
    } else if (!youtubeId && detectedYouTube) {
      setDetectedYouTube(null);
    }
    
    // Detect other links (only if no YouTube)
    if (!youtubeId) {
      const url = extractUrl(text);
      if (url && url !== detectedLink) {
        setDetectedLink(url);
        fetchLinkPreview(url);
      } else if (!url && detectedLink) {
        setDetectedLink(null);
        setLinkPreview(null);
      }
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSelectedFiles(prev => [...prev, ...files]);
    setUploadingFiles(files.map(f => f.name));

    try {
      const token = localStorage.getItem('zion_token');
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const backendModule = moduleMapping[moduleName] || 'personal';
        formData.append('source_module', backendModule);
        formData.append('privacy_level', postVisibility);

        const response = await fetch(`${backendUrl}/api/media/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          return result.id;
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      });

      const uploadedIds = await Promise.all(uploadPromises);
      setUploadedMediaIds(prev => [...prev, ...uploadedIds]);
      setUploadingFiles([]);
      
      triggerConfetti(document.body, {
        particleCount: files.length * 20,
        colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4']
      });
      toast.success(`Загружено ${files.length} файлов в пост!`, 'Успех!', { duration: 3000 });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error(`Ошибка загрузки: ${error.message}`, 'Ошибка');
      setUploadingFiles([]);
      setSelectedFiles(prev => prev.slice(0, -files.length));
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMediaIds(prev => prev.filter((_, i) => i !== index));
  };

  const closeModal = () => {
    const modal = document.querySelector('.post-composer-modal');
    if (modal) {
      modal.style.opacity = '0';
      modal.style.transform = 'scale(0.9)';
      setTimeout(() => {
        modal.style.display = 'none';
        modal.style.opacity = '1';
        modal.style.transform = 'scale(1)';
      }, 200);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if ((!newPost.trim() && selectedFiles.length === 0) || loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const formData = new FormData();
      formData.append('content', newPost.trim() || ' ');
      formData.append('source_module', moduleName.toLowerCase() === 'family' ? 'family' : moduleMapping[moduleName] || 'family');
      formData.append('visibility', postVisibility);
      
      if (detectedYouTube) {
        formData.append('youtube_video_id', detectedYouTube);
      }
      if (linkPreview && !detectedYouTube) {
        formData.append('link_url', linkPreview.url);
        formData.append('link_domain', linkPreview.domain);
      }
      uploadedMediaIds.forEach(id => {
        formData.append('media_file_ids', id);
      });

      const response = await fetch(`${backendUrl}/api/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        // Reset form state
        setNewPost('');
        setSelectedFiles([]);
        setUploadedMediaIds([]);
        setDetectedYouTube(null);
        setDetectedLink(null);
        setLinkPreview(null);
        
        closeModal();
        onPostCreated();
        
        triggerConfetti(document.body, {
          particleCount: 40,
          colors: ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6']
        });
        toast.success('Ваш пост успешно опубликован!', 'Успех!', { duration: 3500 });
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Failed to create post: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert(`Failed to create post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showPostForm = () => {
    const modal = document.querySelector('.post-composer-modal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        const textarea = document.querySelector('.post-textarea');
        if (textarea) textarea.focus();
      }, 100);
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return <Image size={32} />;
    if (file.type.startsWith('video/')) return <Image size={32} />;
    if (file.type.includes('pdf')) return <FileText size={32} color="#DC2626" />;
    if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      return <FileText size={32} color="#1D4ED8" />;
    }
    if (file.type.includes('powerpoint') || file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) {
      return <FileText size={32} color="#DC2626" />;
    }
    if (file.type.includes('excel') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      return <FileText size={32} color="#059669" />;
    }
    return <FileText size={32} />;
  };

  return (
    <>
      {/* Post Creation Trigger */}
      <div className="wall-header">
        <div className="post-composer">
          <div className="post-input-placeholder" onClick={showPostForm}>
            {user?.profile_picture ? (
              <img 
                src={user.profile_picture} 
                alt="Avatar" 
                className="composer-avatar"
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div className="composer-avatar" style={{ backgroundColor: moduleColor }}>
                <User size={20} color="white" />
              </div>
            )}
            <div className="composer-placeholder">
              Что у Вас нового?
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Post Creation Modal */}
      <div 
        className="modal-overlay post-composer-modal" 
        style={{ display: 'none' }}
        onClick={(e) => {
          if (e.target.classList.contains('post-composer-modal')) closeModal();
        }}
      >
        <div className="post-form">
          <form onSubmit={handlePostSubmit}>
            <div className="form-header">
              <h4>Создать запись</h4>
              <button type="button" className="close-btn" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className="form-body">
              {/* Author Section */}
              <div className="form-author-section">
                <div className="form-author-avatar" style={{ backgroundColor: moduleColor }}>
                  <User size={20} color="white" />
                </div>
                <div className="form-author-info">
                  <h5>{user?.first_name} {user?.last_name}</h5>
                  <p>Публикуется в модуле &ldquo;{moduleName}&rdquo;</p>
                </div>
              </div>

              {/* Enhanced Textarea */}
              <textarea
                value={newPost}
                onChange={handlePostTextChange}
                placeholder="Что у Вас нового? Вставьте ссылку на YouTube или любой сайт для превью"
                className="post-textarea"
                rows="3"
                autoFocus
              />
              
              {/* YouTube Preview */}
              {detectedYouTube && (
                <div className="youtube-preview">
                  <div className="preview-header">
                    <span className="preview-label">🎬 YouTube видео</span>
                    <button type="button" className="remove-preview-btn" onClick={() => setDetectedYouTube(null)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className="youtube-embed-container">
                    <iframe
                      src={`https://www.youtube.com/embed/${detectedYouTube}`}
                      title="YouTube video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="youtube-iframe"
                    />
                  </div>
                </div>
              )}
              
              {/* Link Preview */}
              {linkPreview && !detectedYouTube && (
                <div className="link-preview">
                  <div className="preview-header">
                    <span className="preview-label">🔗 Ссылка</span>
                    <button type="button" className="remove-preview-btn" onClick={() => { setDetectedLink(null); setLinkPreview(null); }}>
                      <X size={16} />
                    </button>
                  </div>
                  <a href={linkPreview.url} target="_blank" rel="noopener noreferrer" className="link-preview-card">
                    <div className="link-preview-content">
                      <div className="link-domain">{linkPreview.domain}</div>
                      <div className="link-url">{linkPreview.url}</div>
                    </div>
                    <div className="link-preview-icon"><Share2 size={20} /></div>
                  </a>
                </div>
              )}
              
              {loadingLinkPreview && <div className="link-preview-loading">Загрузка превью...</div>}
              
              {/* File Previews */}
              {selectedFiles.length > 0 && (
                <div className="file-previews">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="file-preview">
                      {file.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(file)} alt="Preview" className="preview-image" />
                      ) : (
                        <div className="preview-document" style={{ background: getFileGradient(file) }}>
                          {getFileIcon(file)}
                          <div className="document-name">{file.name}</div>
                          <div className="document-size">{(file.size / (1024 * 1024)).toFixed(1)}MB</div>
                        </div>
                      )}
                      <button type="button" className="remove-file-btn" onClick={() => removeSelectedFile(index)}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Upload Progress */}
              {uploadingFiles.length > 0 && (
                <div className="upload-progress">
                  <p>Загружаем файлы...</p>
                  {uploadingFiles.map((filename, index) => (
                    <div key={index} className="uploading-file">
                      <div className="upload-spinner"></div>
                      {filename}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="form-actions">
              <div className="media-actions">
                <span className="media-actions-label">Добавить:</span>
                <button 
                  type="button" 
                  className={`media-btn ${selectedFiles.some(f => f.type.startsWith('image/')) ? 'has-files' : ''}`}
                  onClick={() => {
                    fileInputRef.current.accept = "image/jpeg,image/png,image/gif,video/mp4,video/webm,video/ogg";
                    fileInputRef.current?.click();
                  }}
                  title="Добавить фото/видео"
                >
                  <Image size={24} />
                  {selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length > 0 && (
                    <span className="file-count-badge">
                      {selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length}
                    </span>
                  )}
                </button>
                
                <button 
                  type="button" 
                  className={`media-btn ${selectedFiles.some(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')) ? 'has-files' : ''}`}
                  onClick={() => {
                    fileInputRef.current.accept = "application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
                    fileInputRef.current?.click();
                  }}
                  title="Добавить документы"
                >
                  <Paperclip size={24} />
                  {selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')).length > 0 && (
                    <span className="file-count-badge">
                      {selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')).length}
                    </span>
                  )}
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,video/mp4,video/webm,video/ogg,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
            
            <div className="form-footer">
              {/* Visibility Dropdown */}
              <div className="visibility-selector">
                <label htmlFor="post-visibility" className="visibility-label">
                  Кому показать?
                </label>
                <select 
                  id="post-visibility"
                  value={postVisibility}
                  onChange={(e) => setPostVisibility(e.target.value)}
                  className="visibility-dropdown"
                  style={{ borderColor: moduleColor, accentColor: moduleColor }}
                >
                  <option value="FAMILY_ONLY">🔒 Только моя семья</option>
                  <option value="HOUSEHOLD_ONLY">🏠 Только домохозяйство</option>
                  <option value="PUBLIC">🌍 Публично</option>
                  <option value="ONLY_ME">👤 Только я</option>
                  <option value="GENDER_MALE">♂️ Только мужчины</option>
                  <option value="GENDER_FEMALE">♀️ Только женщины</option>
                  <option value="GENDER_IT">🤖 Только IT/AI</option>
                </select>
              </div>
              
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading || (!newPost.trim() && selectedFiles.length === 0)}
                style={{ backgroundColor: loading ? undefined : moduleColor }}
              >
                {loading ? 'Публикуем...' : 'Опубликовать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default PostComposer;
