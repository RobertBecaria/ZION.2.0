import React from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const LightboxModal = ({
  lightboxImage,
  lightboxImages,
  lightboxIndex,
  closeLightbox,
  nextImage,
  prevImage
}) => {
  if (!lightboxImage) return null;

  return (
    <div className="lightbox-overlay" onClick={closeLightbox}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        {/* Header with Controls */}
        <div className="lightbox-header">
          <h3 className="lightbox-title">Просмотр изображения</h3>
          <div className="lightbox-controls">
            <a 
              href={lightboxImage}
              target="_blank"
              rel="noopener noreferrer"
              className="lightbox-download"
              title="Скачать изображение"
            >
              <Download size={18} />
            </a>
            <button className="lightbox-close" onClick={closeLightbox}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Arrows */}
        {lightboxImages.length > 1 && (
          <>
            <button 
              className="lightbox-nav lightbox-prev"
              onClick={prevImage}
              disabled={lightboxIndex === 0}
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              className="lightbox-nav lightbox-next"
              onClick={nextImage}
              disabled={lightboxIndex === lightboxImages.length - 1}
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* Main Image */}
        <img 
          src={lightboxImage}
          alt="Full size image"
          className="lightbox-image"
          style={{ paddingTop: '60px' }} // Space for header
        />

        {/* Image Counter */}
        {lightboxImages.length > 1 && (
          <div className="lightbox-counter">
            {lightboxIndex + 1} из {lightboxImages.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default LightboxModal;