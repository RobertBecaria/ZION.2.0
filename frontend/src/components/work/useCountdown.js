/**
 * useCountdown Hook
 * Real-time countdown timer for task deadlines
 */
import { useState, useEffect, useCallback, useMemo } from 'react';

const useCountdown = (deadline) => {
  const [tick, setTick] = useState(0);

  const calculateTimeRemaining = useCallback(() => {
    if (!deadline) return null;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate - now;

    if (diff <= 0) {
      // Calculate how long overdue
      const overdueDiff = Math.abs(diff);
      const days = Math.floor(overdueDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((overdueDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) {
        return { 
          text: `Просрочено на ${days}д ${hours}ч`, 
          isOverdue: true,
          urgencyLevel: 'overdue'
        };
      }
      return { 
        text: `Просрочено на ${hours}ч`, 
        isOverdue: true,
        urgencyLevel: 'overdue'
      };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Determine urgency level
    let urgencyLevel = 'normal';
    if (days === 0 && hours < 1) {
      urgencyLevel = 'critical';
    } else if (days === 0 && hours < 6) {
      urgencyLevel = 'warning';
    } else if (days < 1) {
      urgencyLevel = 'soon';
    }

    // Format output
    let text;
    let isUrgent = false;
    
    if (days > 7) {
      const weeks = Math.floor(days / 7);
      text = `${weeks}нед ${days % 7}д`;
    } else if (days > 0) {
      text = `${days}д ${hours}ч`;
    } else if (hours > 0) {
      text = `${hours}ч ${minutes}мин`;
    } else if (minutes > 0) {
      text = `${minutes}мин ${seconds}сек`;
      isUrgent = true;
    } else {
      text = `${seconds}сек`;
      isUrgent = true;
    }

    return { text, isOverdue: false, isUrgent, urgencyLevel };
  }, [deadline]);

  // Calculate derived values from tick
  const result = useMemo(() => {
    return calculateTimeRemaining();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculateTimeRemaining, tick]);

  useEffect(() => {
    if (!deadline) return;

    // Determine update interval based on urgency
    const currentResult = calculateTimeRemaining();
    const interval = currentResult?.isUrgent ? 1000 : 60000;

    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, interval);

    return () => clearInterval(timer);
  }, [deadline, calculateTimeRemaining]);

  return { 
    timeRemaining: result, 
    isOverdue: result?.isOverdue || false, 
    urgencyLevel: result?.urgencyLevel || 'normal' 
  };
};

export default useCountdown;
