// Modern Animation Utilities for ZION.CITY
// Implements latest 2024-2025 design trends

/**
 * Confetti Animation - Celebration Effect
 * Triggers confetti particles on success actions
 */
export const triggerConfetti = (targetElement = document.body, options = {}) => {
  const {
    particleCount = 50,
    colors = ['#667eea', '#764ba2', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'],
    duration = 3000
  } = options;

  const container = document.createElement('div');
  container.className = 'confetti';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
  `;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'confetti-particle';
    
    const size = Math.random() * 10 + 5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const startX = Math.random() * 100;
    const delay = Math.random() * 500;
    const animationDuration = Math.random() * 1000 + 2000;
    
    particle.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${startX}%;
      top: -10px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      animation: confetti-fall ${animationDuration}ms linear forwards;
      animation-delay: ${delay}ms;
      opacity: ${Math.random() * 0.5 + 0.5};
    `;
    
    container.appendChild(particle);
  }

  document.body.appendChild(container);

  setTimeout(() => {
    container.remove();
  }, duration + 500);
};

/**
 * Toast Notification System
 * Modern toast notifications with animations
 */
class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    this.init();
  }

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'info', options = {}) {
    const {
      title = '',
      duration = 4000,
      onClose = null
    } = options;

    const id = Date.now() + Math.random();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Close">✕</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => this.hide(id);

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => this.hide(id), duration);
    }

    // Trigger celebration for success
    if (type === 'success') {
      triggerConfetti(toast, { particleCount: 30 });
    }

    return id;
  }

  hide(id) {
    const toast = this.toasts.get(id);
    if (toast) {
      toast.classList.add('hiding');
      setTimeout(() => {
        toast.remove();
        this.toasts.delete(id);
      }, 300);
    }
  }

  success(message, title, options) {
    return this.show(message, 'success', { title, ...options });
  }

  error(message, title, options) {
    return this.show(message, 'error', { title, ...options });
  }

  info(message, title, options) {
    return this.show(message, 'info', { title, ...options });
  }

  warning(message, title, options) {
    return this.show(message, 'warning', { title, ...options });
  }
}

export const toast = new ToastManager();

/**
 * Sparkle Effect on Hover
 * Creates magical sparkle particles
 */
export const createSparkle = (x, y, container = document.body) => {
  const sparkle = document.createElement('div');
  sparkle.className = 'sparkle';
  sparkle.style.left = `${x}px`;
  sparkle.style.top = `${y}px`;
  
  const colors = ['#667eea', '#764ba2', '#ffffff'];
  sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
  
  container.appendChild(sparkle);
  
  setTimeout(() => sparkle.remove(), 800);
};

/**
 * Ripple Effect on Click
 * Material Design-style ripple
 */
export const createRipple = (event, element) => {
  const ripple = document.createElement('span');
  ripple.className = 'ripple-effect';
  
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  
  element.style.position = 'relative';
  element.style.overflow = 'hidden';
  element.appendChild(ripple);
  
  setTimeout(() => ripple.remove(), 600);
};

/**
 * Smooth Scroll with Animation
 */
export const smoothScrollTo = (target, duration = 800) => {
  const targetElement = typeof target === 'string' 
    ? document.querySelector(target) 
    : target;
    
  if (!targetElement) return;
  
  const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;

  const animation = (currentTime) => {
    if (startTime === null) startTime = currentTime;
    const timeElapsed = currentTime - startTime;
    const run = ease(timeElapsed, startPosition, distance, duration);
    window.scrollTo(0, run);
    if (timeElapsed < duration) requestAnimationFrame(animation);
  };

  const ease = (t, b, c, d) => {
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
  };

  requestAnimationFrame(animation);
};

/**
 * Add Celebration Class
 * Triggers celebration animation on element
 */
export const celebrate = (element) => {
  element.classList.add('celebration');
  setTimeout(() => element.classList.remove('celebration'), 600);
};

/**
 * Add Bounce Animation
 */
export const bounce = (element) => {
  element.classList.add('bounce-animation');
  setTimeout(() => element.classList.remove('bounce-animation'), 1000);
};

/**
 * Add Shake Animation (for errors)
 */
export const shake = (element) => {
  element.classList.add('shake-animation');
  setTimeout(() => element.classList.remove('shake-animation'), 500);
};

/**
 * Progress Ring Component Helper
 */
export const updateProgressRing = (element, progress) => {
  const circle = element.querySelector('.progress-ring-progress');
  if (!circle) return;
  
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = offset;
};

export default {
  triggerConfetti,
  toast,
  createSparkle,
  createRipple,
  smoothScrollTo,
  celebrate,
  bounce,
  shake,
  updateProgressRing
};
