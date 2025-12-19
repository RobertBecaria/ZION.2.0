import React from 'react';
import { FileText, Share2, Download, ZoomIn } from 'lucide-react';
import { extractYouTubeId } from './utils/postUtils';

function PostMedia({ post, backendUrl, onImageClick }) {
  return (
    <>
      {/* Display Media Files */}
      {post.media_files && post.media_files.length > 0 && (
        <div className="post-media">
          {post.media_files.map((media, index) => (
            <div key={index} className="media-item">
              {media.file_type === 'image' ? (
                <div 
                  className="image-container"
                  onClick={() => {
                    const postImages = post.media_files
                      .filter(m => m.file_type === 'image')
                      .map(m => `${backendUrl}${m.file_url}`);
                    const imageIndex = postImages.indexOf(`${backendUrl}${media.file_url}`);
                    onImageClick(`${backendUrl}${media.file_url}`, postImages, imageIndex);
                  }}
                >
                  <img 
                    src={`${backendUrl}${media.file_url}`}
                    alt={media.original_filename}
                    className="media-image clickable-image"
                  />
                  <div className="image-overlay">
                    <ZoomIn size={20} color="white" />
                  </div>
                </div>
              ) : (
                <div className="media-document">
                  <FileText size={24} />
                  <div className="doc-info">
                    <span className="doc-name">{media.original_filename}</span>
                    <span className="doc-size">
                      {(media.file_size / (1024 * 1024)).toFixed(1)}MB
                    </span>
                  </div>
                  <a 
                    href={`${backendUrl}${media.file_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-download-btn"
                  >
                    <Download size={16} />
                  </a>
                </div>
              )}
            </div>
          ))}
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
