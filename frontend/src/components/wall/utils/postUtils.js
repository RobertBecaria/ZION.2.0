/**
 * Utility functions for UniversalWall and related components
 */

// Format time to Russian locale relative strings
export const formatTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60 * 1000) return 'только что';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} мин назад`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} ч назад`;
  
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Extract YouTube video ID from URL
export const extractYouTubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Extract YouTube ID from text (for post composer)
export const extractYouTubeIdFromText = (text) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Extract generic URL from text
export const extractUrl = (text) => {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlPattern);
  if (matches) {
    // Filter out YouTube URLs (handled separately)
    const nonYouTubeUrls = matches.filter(url => 
      !url.includes('youtube.com') && !url.includes('youtu.be')
    );
    return nonYouTubeUrls[0] || null;
  }
  return null;
};

// Get file icon color based on file type
export const getFileGradient = (file) => {
  if (file.type?.includes('pdf')) {
    return 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)';
  } else if (file.type?.includes('word') || file.name?.endsWith('.doc') || file.name?.endsWith('.docx')) {
    return 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)';
  } else if (file.type?.includes('powerpoint') || file.name?.endsWith('.ppt') || file.name?.endsWith('.pptx')) {
    return 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)';
  } else if (file.type?.includes('excel') || file.name?.endsWith('.xls') || file.name?.endsWith('.xlsx')) {
    return 'linear-gradient(135deg, #059669 0%, #047857 100%)';
  }
  return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
};

// Map module names to backend format
export const moduleMapping = {
  'Family': 'family',
  'Organizations': 'work',
  'Services': 'business',
  'News': 'community',
  'Journal': 'personal',
  'Marketplace': 'business',
  'Finance': 'business',
  'Events': 'community'
};

// Popular emojis for reactions
export const popularEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];
export const allEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "🔥", "👏", "🤔", "💯"];
