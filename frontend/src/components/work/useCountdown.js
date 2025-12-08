/**
 * useCountdown Hook
 * Real-time countdown timer for task deadlines
 */
import { useState, useEffect, useCallback } from 'react';

const useCountdown = (deadline) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isOverdue, setIsOverdue] = useState(false);
  const [urgencyLevel, setUrgencyLevel] = useState('normal'); // normal, warning, critical, overdue

  const calculateTimeRemaining = useCallback(() => {
    if (!deadline) return null;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate - now;

    if (diff <= 0) {
      setIsOverdue(true);
      setUrgencyLevel('overdue');
      
      // Calculate how long overdue
      const overdueDiff = Math.abs(diff);
      const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) {
        return { text: `Просрочено на ${days}д ${hours}ч`, isOverdue: true };
      }
      return { text: `Просрочено на ${hours}ч`, isOverdue: true };
    }

    setIsOverdue(false);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Determine urgency level
    if (days === 0 && hours < 1) {
      setUrgencyLevel('critical');
    } else if (days === 0 && hours < 6) {
      setUrgencyLevel('warning');
    } else if (days < 1) {
      setUrgencyLevel('soon');
    } else {
      setUrgencyLevel('normal');
    }

    // Format output
    if (days > 7) {
      const weeks = Math.floor(days / 7);
      return { text: `${weeks}нед ${days % 7}д`, isOverdue: false };
    }
    if (days > 0) {
      return { text: `${days}д ${hours}ч`, isOverdue: false };
    }
    if (hours > 0) {
      return { text: `${hours}ч ${minutes}мин`, isOverdue: false };
    }
    if (minutes > 0) {
      return { text: `${minutes}мин ${seconds}сек`, isOverdue: false, isUrgent: true };
    }
    return { text: `${seconds}сек`, isOverdue: false, isUrgent: true };
  }, [deadline]);

  useEffect(() => {
    if (!deadline) {
      setTimeRemaining(null);
      return;
    }

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second for urgent tasks, every minute otherwise
    const result = calculateTimeRemaining();
    const interval = result?.isUrgent ? 1000 : 60000;

    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, interval);

    return () => clearInterval(timer);
  }, [deadline, calculateTimeRemaining]);

  return { timeRemaining, isOverdue, urgencyLevel };
};

export default useCountdown;
