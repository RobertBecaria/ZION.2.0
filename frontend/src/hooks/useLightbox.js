import { useState, useEffect } from 'react';

export const useLightbox = () => {
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (imageUrl, postImages = [], imageIndex = 0) => {
    setLightboxImage(imageUrl);
    setLightboxImages(postImages);
    setLightboxIndex(imageIndex);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
    setLightboxImages([]);
    setLightboxIndex(0);
  };

  const nextImage = () => {
    if (lightboxIndex < lightboxImages.length - 1) {
      const newIndex = lightboxIndex + 1;
      setLightboxIndex(newIndex);
      setLightboxImage(lightboxImages[newIndex]);
    }
  };

  const prevImage = () => {
    if (lightboxIndex > 0) {
      const newIndex = lightboxIndex - 1;
      setLightboxIndex(newIndex);
      setLightboxImage(lightboxImages[newIndex]);
    }
  };

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxImage) {
        if (e.key === 'Escape') {
          closeLightbox();
        } else if (e.key === 'ArrowRight') {
          nextImage();
        } else if (e.key === 'ArrowLeft') {
          prevImage();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxImage, lightboxIndex, lightboxImages]);

  return {
    lightboxImage,
    lightboxImages,
    lightboxIndex,
    openLightbox,
    closeLightbox,
    nextImage,
    prevImage
  };
};