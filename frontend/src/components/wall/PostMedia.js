import React from 'react';
import { FileText, Share2, Download, ZoomIn, Play } from 'lucide-react';
import { extractYouTubeId } from './utils/postUtils';

function PostMedia({ post, backendUrl, onImageClick }) {
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
                  <div 
                    className="image-container"
                    onClick={() => {
                      if (onImageClick) {
                        const postImages = post.media_files.map(m => getMediaUrl(m));
                        onImageClick(mediaUrl, postImages, index);
                      }
                    }}
                  >
                    <img 
                      src={mediaUrl}
                      alt={media.original_filename || 'Изображение'}
                      className="media-image clickable-image"
                      loading="lazy"
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

      {/* Display YouTube Videos from youtube_urls array */}
      {post.youtube_urls && post.youtube_urls.length > 0 && (
        <div className="post-youtube">
          {post.youtube_urls.map((url, index) => {
            const videoId = extractYouTubeId(url);
            return videoId ? (
              <div key={index} className="youtube-embed">
                <iframe
                  width="100%"
                  height="315"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title={`YouTube video ${index + 1}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            ) : null;
          })}
        </div>
      )}
      
      {/* Display single YouTube video from youtube_video_id */}
      {post.youtube_video_id && !post.youtube_urls?.length && (
        <div className="post-youtube">
          <div className="youtube-embed">
            <iframe
              width="100%"
              height="315"
              src={`https://www.youtube.com/embed/${post.youtube_video_id}`}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
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
    </>
  );
}

export default PostMedia;
