import React, { useState } from 'react';
import { FileText, Share2, Download, ZoomIn, Play, ImageOff } from 'lucide-react';
import { extractYouTubeId } from './utils/postUtils';

function PostMedia({ post, backendUrl, onImageClick }) {
  const [playingVideo, setPlayingVideo] = useState(null);
  const [failedImages, setFailedImages] = useState({});

  // Handle image load error
  const handleImageError = (mediaId) => {
    setFailedImages(prev => ({ ...prev, [mediaId]: true }));
  };
  
  // Helper to get media URL - handles both object format and string ID format
  const getMediaUrl = (media) => {
    // If media is just a string (ID), use the /api/media/{id} endpoint
    if (typeof media === 'string') {
      return `${backendUrl}/api/media/${media}`;
    }
    // If media is an object with file_url, use that
    if (media.file_url) {
      return `${backendUrl}${media.file_url}`;
    }
    // If media has an id, use that
    if (media.id) {
      return `${backendUrl}/api/media/${media.id}`;
    }
    return '';
  };
  
  // Check if media is an image
  const isImage = (media) => {
    if (typeof media === 'string') return true; // Assume IDs are images by default
    return media.file_type === 'image';
  };
  
  // Helper to extract YouTube ID from URL
  const getYoutubeId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  return (
    <>
      {/* Display Media Files - supports both object array and ID array formats */}
      {post.media_files && post.media_files.length > 0 && (
        <div className={`post-media-gallery gallery-${Math.min(post.media_files.length, 4)}`}>
          {post.media_files.slice(0, 4).map((media, index) => {
            const mediaUrl = getMediaUrl(media);
            const mediaId = typeof media === 'string' ? media : (media.id || index);
            
            return (
              <div key={mediaId} className="media-item">
                {isImage(media) ? (
                  failedImages[mediaId] ? (
                    <div className="image-error-placeholder">
                      <ImageOff size={32} color="#9CA3AF" />
                      <span>Не удалось загрузить изображение</span>
                    </div>
                  ) : (
                    <div
                      className="image-container"
                      onClick={() => {
                        if (onImageClick) {
                          const postImages = post.media_files
                            .filter((m, i) => !failedImages[typeof m === 'string' ? m : (m.id || i)])
                            .map(m => getMediaUrl(m));
                          const adjustedIndex = postImages.indexOf(mediaUrl);
                          onImageClick(mediaUrl, postImages, adjustedIndex >= 0 ? adjustedIndex : 0);
                        }
                      }}
                    >
                      <img
                        src={mediaUrl}
                        alt={media.original_filename || 'Изображение'}
                        className="media-image clickable-image"
                        loading="lazy"
                        onError={() => handleImageError(mediaId)}
                      />
                      <div className="image-overlay">
                        <ZoomIn size={20} color="white" />
                      </div>
                      {index === 3 && post.media_files.length > 4 && (
                        <div className="more-overlay">
                          +{post.media_files.length - 4}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="media-document">
                    <FileText size={24} />
                    <div className="doc-info">
                      <span className="doc-name">{media.original_filename || 'Документ'}</span>
                      {media.file_size && (
                        <span className="doc-size">
                          {(media.file_size / (1024 * 1024)).toFixed(1)}MB
                        </span>
                      )}
                    </div>
                    <a 
                      href={mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="doc-download-btn"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Display YouTube Videos from youtube_urls array - with click-to-play */}
      {post.youtube_urls && post.youtube_urls.length > 0 && (
        <div className="post-youtube-embeds">
          {post.youtube_urls.map((url, index) => {
            const youtubeId = getYoutubeId(url) || extractYouTubeId(url);
            if (!youtubeId) return null;
            
            return (
              <div key={index} className="youtube-embed">
                {playingVideo === youtubeId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                    title="YouTube video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div 
                    className="youtube-thumbnail-wrapper"
                    onClick={() => setPlayingVideo(youtubeId)}
                  >
                    <img 
                      src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                      alt="YouTube thumbnail"
                    />
                    <div className="play-button">
                      <Play size={48} fill="white" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Display single YouTube video from youtube_video_id */}
      {post.youtube_video_id && !post.youtube_urls?.length && (
        <div className="post-youtube-embeds">
          <div className="youtube-embed">
            {playingVideo === post.youtube_video_id ? (
              <iframe
                src={`https://www.youtube.com/embed/${post.youtube_video_id}?autoplay=1`}
                title="YouTube video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div 
                className="youtube-thumbnail-wrapper"
                onClick={() => setPlayingVideo(post.youtube_video_id)}
              >
                <img 
                  src={`https://img.youtube.com/vi/${post.youtube_video_id}/hqdefault.jpg`}
                  alt="YouTube thumbnail"
                />
                <div className="play-button">
                  <Play size={48} fill="white" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Display Link Preview */}
      {post.link_url && !post.youtube_video_id && (
        <div className="post-link-preview">
          <a 
            href={post.link_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="link-preview-card"
          >
            <div className="link-preview-content">
              <div className="link-domain">{post.link_domain || new URL(post.link_url).hostname}</div>
              <div className="link-url">{post.link_url}</div>
            </div>
            <div className="link-preview-icon">
              <Share2 size={20} />
            </div>
          </a>
        </div>
      )}
      
      {/* Styles for media gallery and YouTube */}
      <style jsx="true">{`
        .post-media-gallery {
          display: grid;
          gap: 4px;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        
        .post-media-gallery.gallery-1 {
          grid-template-columns: 1fr;
        }
        
        .post-media-gallery.gallery-2 {
          grid-template-columns: 1fr 1fr;
        }
        
        .post-media-gallery.gallery-3 {
          grid-template-columns: 1fr 1fr;
        }
        
        .post-media-gallery.gallery-3 .media-item:first-child {
          grid-column: span 2;
        }
        
        .post-media-gallery.gallery-4 {
          grid-template-columns: 1fr 1fr;
        }
        
        .post-media-gallery .media-item {
          position: relative;
          aspect-ratio: 16/9;
          overflow: hidden;
        }
        
        .post-media-gallery .image-container {
          width: 100%;
          height: 100%;
          cursor: pointer;
          position: relative;
        }
        
        .post-media-gallery .media-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .post-media-gallery .image-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.2s;
        }
        
        .post-media-gallery .image-container:hover .image-overlay {
          background: rgba(0, 0, 0, 0.3);
          opacity: 1;
        }

        .image-error-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          gap: 8px;
        }

        .image-error-placeholder span {
          font-size: 12px;
          color: #9CA3AF;
          text-align: center;
        }

        .post-media-gallery .more-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: 600;
        }
        
        .post-youtube-embeds {
          margin-bottom: 8px;
        }
        
        .youtube-embed {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          border-radius: 12px;
          overflow: hidden;
          background: #000;
        }
        
        .youtube-embed iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        
        .youtube-thumbnail-wrapper {
          position: absolute;
          inset: 0;
          cursor: pointer;
        }
        
        .youtube-thumbnail-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .youtube-thumbnail-wrapper .play-button {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 68px;
          height: 48px;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        
        .youtube-thumbnail-wrapper:hover .play-button {
          background: #ff0000;
        }
        
        .media-document {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f0f2f5;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        
        .doc-info {
          flex: 1;
          min-width: 0;
        }
        
        .doc-name {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #1c1e21;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .doc-size {
          display: block;
          font-size: 12px;
          color: #65676b;
        }
        
        .doc-download-btn {
          padding: 8px;
          background: white;
          border-radius: 50%;
          color: #65676b;
          transition: all 0.2s;
        }
        
        .doc-download-btn:hover {
          background: #e4e6e9;
        }
        
        .post-link-preview {
          margin-bottom: 8px;
        }
        
        .link-preview-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #f0f2f5;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.2s;
        }
        
        .link-preview-card:hover {
          background: #e4e6e9;
        }
        
        .link-preview-content {
          flex: 1;
          min-width: 0;
        }
        
        .link-domain {
          font-size: 12px;
          color: #65676b;
          text-transform: uppercase;
        }
        
        .link-url {
          font-size: 14px;
          color: #1c1e21;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .link-preview-icon {
          color: #65676b;
          margin-left: 12px;
        }
      `}</style>
    </>
  );
}

export default PostMedia;
