import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Upload, Loader } from 'lucide-react';

function ProfileImageUpload({ 
  type = 'avatar', // 'avatar' or 'banner'
  currentImage = null,
  onUploadComplete,
  moduleColor = '#059669'
}) {
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview) return;

    setUploading(true);
    try {
      // Call parent callback with base64 image
      if (onUploadComplete) {
        await onUploadComplete(preview);
      }
      
      setShowModal(false);
      setPreview(null);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Ошибка при загрузке изображения');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <button
        className={type === 'banner' ? 'banner-upload-btn' : 'avatar-upload-btn'}
        onClick={() => setShowModal(true)}
        title={type === 'banner' ? 'Изменить баннер' : 'Изменить аватар'}
      >
        <Camera size={type === 'banner' ? 20 : 16} />
      </button>

      {showModal && (
        <div className="image-upload-modal-overlay" onClick={handleCancel}>
          <div className="image-upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {type === 'banner' ? 'Загрузить баннер' : 'Загрузить аватар'}
              </h3>
              <button className="close-btn" onClick={handleCancel}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {!preview ? (
                <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={48} color={moduleColor} />
                  <p>Нажмите для выбора изображения</p>
                  <span className="hint">PNG, JPG до 5MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div className="preview-area">
                  <img 
                    src={preview} 
                    alt="Preview" 
                    className={type === 'banner' ? 'banner-preview' : 'avatar-preview'}
                  />
                  <button 
                    className="change-image-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Выбрать другое изображение
                  </button>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={handleCancel}
                disabled={uploading}
              >
                Отмена
              </button>
              <button 
                className="btn-primary"
                onClick={handleUpload}
                disabled={!preview || uploading}
                style={{ backgroundColor: moduleColor }}
              >
                {uploading ? (
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
      )}
    </>
  );
}

export default ProfileImageUpload;
