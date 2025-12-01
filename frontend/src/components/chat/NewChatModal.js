/**
 * NewChatModal Component
 * Modal for starting a new direct chat conversation
 */
import React, { useState, useEffect } from 'react';
import { X, Search, User, MessageCircle } from 'lucide-react';

const NewChatModal = ({ onClose, onChatCreated, moduleColor }) => {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [searchQuery]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('zion_token');
      const url = searchQuery 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/users/contacts?search=${encodeURIComponent(searchQuery)}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/users/contacts`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (recipientId) => {
    setCreating(true);
    try {
      const token = localStorage.getItem('zion_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/direct-chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipient_id: recipientId })
      });
      
      if (response.ok) {
        const data = await response.json();
        onChatCreated(data.chat_id);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-chat-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><MessageCircle size={20} /> Новый чат</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="search-contacts">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Поиск по имени или email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          
          <div className="contacts-list">
            {loading ? (
              <div className="loading-contacts">
                <p>Загрузка контактов...</p>
              </div>
            ) : contacts.length === 0 ? (
              <div className="no-contacts">
                <User size={48} color="#9ca3af" />
                <p>{searchQuery ? 'Пользователи не найдены' : 'Нет доступных контактов'}</p>
              </div>
            ) : (
              contacts.map(contact => (
                <div
                  key={contact.id}
                  className="contact-item"
                  onClick={() => !creating && startChat(contact.id)}
                >
                  <div className="contact-avatar">
                    {contact.profile_picture ? (
                      <img src={contact.profile_picture} alt="" />
                    ) : (
                      <div className="avatar-placeholder" style={{ backgroundColor: moduleColor }}>
                        {contact.first_name?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div className="contact-info">
                    <h4>{contact.first_name} {contact.last_name}</h4>
                    <p>{contact.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
