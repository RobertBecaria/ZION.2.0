import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, Upload, Loader } from 'lucide-react';
import { toast } from '../utils/animations';

/**
 * ProfileImageUpload Component
 * A simple, robust image upload modal for avatars and banners
 * Uses React Portal to prevent parent re-render issues
 */
function ProfileImageUpload({ 
  type = 'avatar', // 'avatar' or 'banner'
  currentImage = null,
  onUploadComplete,
  moduleColor = '#059669'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Open modal handler
  const openModal = () => {
    setIsOpen(true);
    setPreviewImage(null);
  };

  // Close modal handler
  const closeModal = () => {
    setIsOpen(false);
    setPreviewImage(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // File selection handler
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.warning('Пожалуйста, выберите изображение');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('Размер файла не должен превышать 5MB');
      return;
    }

    // Read and preview file
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload handler
  const handleUpload = async () => {
    if (!previewImage) return;

    setIsUploading(true);
    
    try {
      if (onUploadComplete) {
        await onUploadComplete(previewImage);
      }
      closeModal();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Ошибка при загрузке изображения');
      setIsUploading(false);
    }
  };

  // Select file button handler
  const selectFile = () => {
    fileInputRef.current?.click();
  };

  // Modal content
  const modalContent = isOpen ? (
    <div 
      className="image-upload-modal-overlay" 
      onClick={closeModal}
      style={{ zIndex: 10000 }}
    >
      <div 
        className="image-upload-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 10001 }}
      >
        {/* Header */}
        <div className="modal-header">
          <h3>
            {type === 'banner' ? 'Загрузить баннер' : 'Загрузить аватар'}
          </h3>
          <button 
            className="close-btn" 
            onClick={closeModal}
            type="button"
            disabled={isUploading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {!previewImage ? (
            <div className="upload-area" onClick={selectFile}>
              <Upload size={48} color={moduleColor} />
              <p>Нажмите для выбора изображения</p>
              <span className="hint">PNG, JPG до 5MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="preview-area">
              <img 
                src={previewImage} 
                alt="Preview" 
                className={type === 'banner' ? 'banner-preview' : 'avatar-preview'}
              />
              <button 
                className="change-image-btn"
                onClick={selectFile}
                type="button"
                disabled={isUploading}
              >
                Выбрать другое изображение
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button 
            className="btn-secondary"
            onClick={closeModal}
            type="button"
            disabled={isUploading}
          >
            Отмена
          </button>
          <button 
            className="btn-primary"
            onClick={handleUpload}
            type="button"
            disabled={!previewImage || isUploading}
            style={{ backgroundColor: moduleColor }}
          >
            {isUploading ? (
              <>
                <Loader size={16} className="spinning" />
                Загрузка...
              </>
            ) : (
              'Сохранить'
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Upload button */}
      <button
        className={type === 'banner' ? 'banner-upload-btn' : 'avatar-upload-btn'}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          openModal();
        }}
        title={type === 'banner' ? 'Изменить баннер' : 'Изменить аватар'}
        type="button"
        style={{ 
          pointerEvents: 'auto',
          zIndex: 10000,
          position: 'absolute'
        }}
      >
        <Camera size={type === 'banner' ? 20 : 16} />
      </button>

      {/* Modal via Portal */}
      {modalContent && createPortal(modalContent, document.body)}
    </>
  );
}

export default ProfileImageUpload;
