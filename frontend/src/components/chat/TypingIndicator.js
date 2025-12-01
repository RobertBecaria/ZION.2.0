/**
 * TypingIndicator Component
 * Shows when someone is typing in the chat
 */
import React from 'react';

const TypingIndicator = ({ typingUsers = [], moduleColor = '#059669' }) => {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].user_name || 'Кто-то'} печатает`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].user_name} и ${typingUsers[1].user_name} печатают`;
    } else {
      return 'Несколько человек печатают';
    }
  };

  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <span style={{ backgroundColor: moduleColor }}></span>
        <span style={{ backgroundColor: moduleColor }}></span>
        <span style={{ backgroundColor: moduleColor }}></span>
      </div>
      <span className="typing-text">{getTypingText()}...</span>
    </div>
  );
};

export default TypingIndicator;
