import React, { useRef, useState } from 'react';
import { User, Image, Paperclip, X, Share2, FileText, Sparkles, Bot, Check, Copy, ChevronDown } from 'lucide-react';
import { extractYouTubeIdFromText, extractUrl, getFileGradient, moduleMapping } from './utils/postUtils';
import { triggerConfetti, toast } from '../../utils/animations';
import ERICAnalyzeButton from '../eric/ERICAnalyzeButton';

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
  const [ericAnalysis, setEricAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisCopied, setAnalysisCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const fetchLinkPreview = async (url) => {
    setLoadingLinkPreview(true);
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      setLinkPreview({ url, domain, title: domain, description: url });
    } catch (error) {
      setLinkPreview(null);
    } finally {
      setLoadingLinkPreview(false);
    }
  };

  const handlePostTextChange = (e) => {
    const text = e.target.value;
    setNewPost(text);
    
    const youtubeId = extractYouTubeIdFromText(text);
    if (youtubeId && youtubeId !== detectedYouTube) {
      setDetectedYouTube(youtubeId);
      setDetectedLink(null);
      setLinkPreview(null);
    } else if (!youtubeId && detectedYouTube) {
      setDetectedYouTube(null);
    }
    
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
      
      toast.success(`Загружено ${files.length} файлов`, 'Успех!', { duration: 2000 });
    } catch (error) {
      toast.error(`Ошибка загрузки: ${error.message}`, 'Ошибка');
      setUploadingFiles([]);
      setSelectedFiles(prev => prev.slice(0, -files.length));
    }
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMediaIds(prev => prev.filter((_, i) => i !== index));
    if (ericAnalysis) setEricAnalysis(null);
  };

  const handleAnalysisComplete = (result) => {
    setEricAnalysis(result);
    setShowAnalysisModal(true);
  };

  const handleAnalysisError = (error) => {
    toast.error(error, 'Ошибка анализа');
  };

  const copyAnalysis = () => {
    if (ericAnalysis?.analysis) {
      navigator.clipboard.writeText(ericAnalysis.analysis);
      setAnalysisCopied(true);
      setTimeout(() => setAnalysisCopied(false), 2000);
    }
  };

  const addAnalysisToPost = () => {
    if (ericAnalysis?.analysis) {
      setNewPost(prev => prev ? `${prev}\n\n📊 Анализ ERIC:\n${ericAnalysis.analysis}` : `📊 Анализ ERIC:\n${ericAnalysis.analysis}`);
      setShowAnalysisModal(false);
      toast.success('Анализ добавлен в пост', 'Готово!');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
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
        toast.success('Пост опубликован!', 'Успех!', { duration: 2500 });
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Failed to create post: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      toast.error(`Ошибка: ${error.message}`, 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const showPostForm = () => {
    setIsModalOpen(true);
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return <Image size={20} />;
    if (file.type.startsWith('video/')) return <Image size={20} />;
    if (file.type.includes('pdf')) return <FileText size={20} color="#DC2626" />;
    if (file.type.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      return <FileText size={20} color="#1D4ED8" />;
    }
    return <FileText size={20} />;
  };

  const visibilityOptions = [
    { value: 'FAMILY_ONLY', label: 'Только моя семья', icon: '🔒' },
    { value: 'HOUSEHOLD_ONLY', label: 'Домохозяйство', icon: '🏠' },
    { value: 'PUBLIC', label: 'Публично', icon: '🌍' },
    { value: 'ONLY_ME', label: 'Только я', icon: '👤' },
    { value: 'GENDER_MALE', label: 'Только мужчины', icon: '♂️' },
    { value: 'GENDER_FEMALE', label: 'Только женщины', icon: '♀️' },
    { value: 'GENDER_IT', label: 'IT/AI', icon: '🤖' },
    { value: 'ERIC_AI', label: 'Спросить ERIC AI', icon: '✨' },
  ];

  const currentVisibility = visibilityOptions.find(v => v.value === postVisibility) || visibilityOptions[0];

  return (
    <>
      {/* Trigger Button */}
      <div className="wall-header">
        <div className="post-composer">
          <div 
            className="post-input-placeholder" 
            onClick={showPostForm}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: '#f8f9fa',
              borderRadius: 24,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {user?.profile_picture ? (
              <img 
                src={user.profile_picture} 
                alt="Avatar" 
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ 
                width: 40, height: 40, borderRadius: '50%', 
                backgroundColor: moduleColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <User size={20} color="white" />
              </div>
            )}
            <span style={{ color: '#65676B', fontSize: 15 }}>Что у Вас нового?</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div 
          onClick={(e) => e.target === e.currentTarget && closeModal()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
        >
          <div style={{
            background: 'white',
            borderRadius: 16,
            width: '100%',
            maxWidth: 500,
            maxHeight: 'calc(100vh - 32px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'modalIn 0.2s ease-out'
          }}>
            {/* Header - Fixed */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              flexShrink: 0
            }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Создать запись</h3>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#f3f4f6', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
              minHeight: 0
            }}>
              {/* Author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  backgroundColor: moduleColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <User size={22} color="white" />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{user?.first_name} {user?.last_name}</p>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 13, color: '#6b7280'
                  }}>
                    <span>{currentVisibility.icon}</span>
                    <span>{currentVisibility.label}</span>
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={newPost}
                onChange={handlePostTextChange}
                placeholder="Что у Вас нового?"
                autoFocus
                style={{
                  width: '100%',
                  minHeight: 100,
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontSize: 16,
                  lineHeight: 1.5,
                  fontFamily: 'inherit'
                }}
              />

              {/* YouTube Preview */}
              {detectedYouTube && (
                <div style={{
                  marginTop: 12,
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: '#f9fafb'
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>🎬 YouTube</span>
                    <button 
                      type="button"
                      onClick={() => setDetectedYouTube(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <X size={16} color="#9ca3af" />
                    </button>
                  </div>
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${detectedYouTube}`}
                      title="YouTube"
                      frameBorder="0"
                      allowFullScreen
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
              )}

              {/* Link Preview */}
              {linkPreview && !detectedYouTube && (
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>🔗 {linkPreview.domain}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{linkPreview.url}</div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => { setDetectedLink(null); setLinkPreview(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    <X size={16} color="#9ca3af" />
                  </button>
                </div>
              )}

              {/* File Previews */}
              {selectedFiles.length > 0 && (
                <div style={{
                  marginTop: 12,
                  display: 'grid',
                  gridTemplateColumns: selectedFiles.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                  gap: 8
                }}>
                  {selectedFiles.map((file, index) => (
                    <div key={index} style={{
                      position: 'relative',
                      borderRadius: 12,
                      overflow: 'hidden',
                      background: '#f3f4f6',
                      aspectRatio: file.type.startsWith('image/') ? 'auto' : '16/9'
                    }}>
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Preview" 
                          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 200, objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          height: '100%', minHeight: 80,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          padding: 16, background: getFileGradient(file)
                        }}>
                          {getFileIcon(file)}
                          <span style={{ 
                            fontSize: 12, marginTop: 8, textAlign: 'center',
                            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', color: 'white'
                          }}>
                            {file.name}
                          </span>
                        </div>
                      )}
                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={16} color="white" />
                      </button>
                      {/* ERIC Button */}
                      <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                        <ERICAnalyzeButton
                          file={file}
                          context={moduleName === 'Family' ? 'family' : moduleName === 'Work' ? 'work' : 'generic'}
                          contextData={{ moduleName }}
                          onAnalysisComplete={handleAnalysisComplete}
                          onError={handleAnalysisError}
                          variant="icon-only"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Progress */}
              {uploadingFiles.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: moduleColor }}>
                  <div style={{
                    width: 16, height: 16,
                    border: `2px solid ${moduleColor}`,
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: 14 }}>Загрузка...</span>
                </div>
              )}
            </div>

            {/* Footer - Fixed */}
            <div style={{
              padding: '12px 20px 16px',
              borderTop: '1px solid #e5e7eb',
              flexShrink: 0
            }}>
              {/* Action Buttons Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current.accept = "image/*,video/*";
                      fileInputRef.current?.click();
                    }}
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: 'transparent', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative'
                    }}
                    title="Фото/видео"
                  >
                    <Image size={22} color="#10B981" />
                    {selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#10B981', color: 'white',
                        fontSize: 10, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).length}
                      </span>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current.accept = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
                      fileInputRef.current?.click();
                    }}
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: 'transparent', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', position: 'relative'
                    }}
                    title="Документы"
                  >
                    <Paperclip size={22} color="#F59E0B" />
                    {selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')).length > 0 && (
                      <span style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#F59E0B', color: 'white',
                        fontSize: 10, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/')).length}
                      </span>
                    )}
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Visibility Selector */}
                <select
                  value={postVisibility}
                  onChange={(e) => setPostVisibility(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {visibilityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Publish Button */}
              <button
                type="button"
                onClick={handlePostSubmit}
                disabled={loading || (!newPost.trim() && selectedFiles.length === 0)}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: 10,
                  border: 'none',
                  background: loading || (!newPost.trim() && selectedFiles.length === 0) 
                    ? '#e5e7eb' 
                    : moduleColor,
                  color: loading || (!newPost.trim() && selectedFiles.length === 0) ? '#9ca3af' : 'white',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loading || (!newPost.trim() && selectedFiles.length === 0) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? 'Публикация...' : 'Опубликовать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERIC Analysis Modal */}
      {showAnalysisModal && ericAnalysis && (
        <div 
          onClick={(e) => e.target === e.currentTarget && setShowAnalysisModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: 16
          }}
        >
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 24,
            maxWidth: 480,
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #FFD93D 0%, #FF9500 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Bot size={22} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Анализ ERIC</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Ваш AI-ассистент</p>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                style={{
                  marginLeft: 'auto',
                  background: '#f3f4f6',
                  border: 'none',
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} color="#6b7280" />
              </button>
            </div>

            <div style={{
              background: '#f8f9fa',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              fontSize: 14,
              lineHeight: 1.6,
              color: '#374151',
              whiteSpace: 'pre-wrap'
            }}>
              {ericAnalysis.analysis}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={copyAnalysis}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  color: analysisCopied ? '#10B981' : '#374151'
                }}
              >
                {analysisCopied ? <Check size={18} /> : <Copy size={18} />}
                {analysisCopied ? 'Скопировано' : 'Копировать'}
              </button>
              <button
                onClick={addAnalysisToPost}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #FFD93D 0%, #FF9500 100%)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white'
                }}
              >
                <Sparkles size={18} />
                В пост
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export default PostComposer;
