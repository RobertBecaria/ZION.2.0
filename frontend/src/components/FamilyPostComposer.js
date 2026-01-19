import React, { useState, useRef } from 'react';
import { Send, Users, Home, Globe, Image, Paperclip, X, Bot, Check, Copy, Sparkles, FileText } from 'lucide-react';
import ERICAnalyzeButton from './eric/ERICAnalyzeButton';
import { toast } from '../utils/animations';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const FamilyPostComposer = ({ familyUnit, user, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('FAMILY_ONLY');
  const [posting, setPosting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedMediaIds, setUploadedMediaIds] = useState([]);
  const [ericAnalysis, setEricAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisCopied, setAnalysisCopied] = useState(false);
  const fileInputRef = useRef(null);

  const visibilityOptions = [
    { value: 'FAMILY_ONLY', label: 'Только семья', icon: Users, description: 'Видят только члены вашей семьи' },
    { value: 'HOUSEHOLD_ONLY', label: 'Домохозяйство', icon: Home, description: 'Видят все семьи в вашем доме' },
    { value: 'PUBLIC', label: 'Публичный', icon: Globe, description: 'Видят все ваши связи' }
  ];

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSelectedFiles(prev => [...prev, ...files]);
    setUploadingFiles(true);

    try {
      const token = localStorage.getItem('zion_token');
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_module', 'family');

        const response = await fetch(`${BACKEND_URL}/api/media/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          return result.id;
        }
        throw new Error(`Ошибка загрузки ${file.name}`);
      });

      const uploadedIds = await Promise.all(uploadPromises);
      setUploadedMediaIds(prev => [...prev, ...uploadedIds]);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Ошибка загрузки файлов');
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMediaIds(prev => prev.filter((_, i) => i !== index));
    if (ericAnalysis) setEricAnalysis(null);
  };

  const handleAnalysisComplete = (result) => {
    setEricAnalysis(result);
    setShowAnalysisModal(true);
  };

  const handleAnalysisError = (err) => {
    toast.error(err);
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
      setContent(prev => prev ? `${prev}\n\n📊 Анализ ERIC:\n${ericAnalysis.analysis}` : `📊 Анализ ERIC:\n${ericAnalysis.analysis}`);
      setShowAnalysisModal(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && selectedFiles.length === 0) return;

    setPosting(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(
        `${BACKEND_URL}/api/family-units/${familyUnit.id}/posts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content,
            visibility,
            media_files: uploadedMediaIds
          })
        }
      );

      if (response.ok) {
        setContent('');
        setVisibility('FAMILY_ONLY');
        setSelectedFiles([]);
        setUploadedMediaIds([]);
        setEricAnalysis(null);
        onPostCreated();
      } else {
        toast.error('Не удалось создать пост');
      }
    } catch (err) {
      toast.error('Ошибка при создании поста');
    } finally {
      setPosting(false);
    }
  };

  const selectedOption = visibilityOptions.find(opt => opt.value === visibility);
  const SelectedIcon = selectedOption?.icon || Users;

  return (
    <div className="family-post-composer">
      <div className="composer-header">
        <h3>Создать пост от имени {familyUnit.family_name}</h3>
      </div>

      <form onSubmit={handleSubmit} className="composer-form">
        <div className="composer-input-area">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Что нового в семье ${familyUnit.family_surname}?`}
            rows={4}
            disabled={posting}
          />
        </div>

        {/* File Previews */}
        {selectedFiles.length > 0 && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 12, 
            marginTop: 12,
            padding: 12,
            background: '#f8f9fa',
            borderRadius: 12
          }}>
            {selectedFiles.map((file, index) => (
              <div 
                key={index} 
                style={{
                  position: 'relative',
                  background: 'white',
                  borderRadius: 8,
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 150,
                  border: '1px solid #e0e0e0'
                }}
              >
                {file.type.startsWith('image/') ? (
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt="" 
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
                  />
                ) : (
                  <div style={{
                    width: 48,
                    height: 48,
                    background: '#E8F5E9',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4CAF50'
                  }}>
                    <FileText size={24} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ 
                    margin: 0, 
                    fontSize: 13, 
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>{file.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#888' }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#EF4444',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={12} color="white" />
                </button>
                {/* ERIC Analyze Button */}
                <div style={{ position: 'absolute', bottom: -8, right: -8 }}>
                  <ERICAnalyzeButton
                    file={file}
                    context="family"
                    contextData={{ 
                      familyName: familyUnit.family_name,
                      familySurname: familyUnit.family_surname
                    }}
                    onAnalysisComplete={handleAnalysisComplete}
                    onError={handleAnalysisError}
                    variant="icon-only"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {uploadingFiles && (
          <div style={{ 
            marginTop: 12, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            color: '#4CAF50'
          }}>
            <div style={{
              width: 16,
              height: 16,
              border: '2px solid #4CAF50',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span style={{ fontSize: 14 }}>Загрузка файлов...</span>
          </div>
        )}

        {/* Media Upload Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid #eee'
        }}>
          <button
            type="button"
            onClick={() => {
              fileInputRef.current.accept = "image/*,video/*";
              fileInputRef.current.click();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: '#E8F5E9',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: '#4CAF50',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            <Image size={18} />
            Фото/Видео
          </button>
          <button
            type="button"
            onClick={() => {
              fileInputRef.current.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
              fileInputRef.current.click();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: '#E8F5E9',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: '#4CAF50',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            <Paperclip size={18} />
            Документ
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        <div className="composer-visibility">
          <label>Видимость поста:</label>
          <div className="visibility-options">
            {visibilityOptions.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`visibility-option ${visibility === option.value ? 'active' : ''}`}
                  onClick={() => setVisibility(option.value)}
                >
                  <Icon size={20} />
                  <div>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="composer-actions">
          <div className="post-info">
            <SelectedIcon size={16} />
            <span>Публикуется как: {user.first_name} ({familyUnit.family_name})</span>
          </div>
          <button
            type="submit"
            className="btn-primary btn-post"
            disabled={(!content.trim() && selectedFiles.length === 0) || posting}
            style={{ background: '#4CAF50' }}
            onMouseOver={(e) => !e.target.disabled && (e.target.style.background = '#45a049')}
            onMouseOut={(e) => !e.target.disabled && (e.target.style.background = '#4CAF50')}
          >
            <Send size={18} />
            {posting ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </form>

      {/* ERIC Analysis Modal */}
      {showAnalysisModal && ericAnalysis && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAnalysisModal(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}
        >
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 24,
            maxWidth: 500,
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={20} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Анализ ERIC</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#666' }}>Семейное фото</p>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8
                }}
              >
                <X size={20} color="#666" />
              </button>
            </div>

            <div style={{
              background: '#f8f9fa',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              fontSize: 14,
              lineHeight: 1.6,
              color: '#333',
              whiteSpace: 'pre-wrap'
            }}>
              {ericAnalysis.analysis}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={copyAnalysis}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #e0e0e0',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  color: analysisCopied ? '#4CAF50' : '#333'
                }}
              >
                {analysisCopied ? <Check size={18} /> : <Copy size={18} />}
                {analysisCopied ? 'Скопировано' : 'Копировать'}
              </button>
              <button
                onClick={addAnalysisToPost}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'white'
                }}
              >
                <Sparkles size={18} />
                Добавить в пост
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FamilyPostComposer;
