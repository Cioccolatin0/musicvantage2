import React, { useState, useEffect, useRef } from 'react';
import { getSocket, getChatHistory } from '../api';

export default function Chat({ room, userId, username, userColor, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [users, setUsers] = useState([]);
  const listRef = useRef(null);
  const socket = getSocket();

  useEffect(() => {
    getChatHistory(room).then(setMessages);
    socket.emit('join-chat', room);
    socket.on('chat-message', (msg) => {
      if (msg.sender_id !== userId) {
        setMessages(m => [...m, msg]);
      } else {
        setMessages(m => [...m, msg]);
      }
    });
    return () => { socket.emit('leave-chat', room); socket.off('chat-message'); };
  }, [room]);

  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [messages]);
  useEffect(() => { setUsers(u => u.includes(username) ? u : [...u, username]); }, [username]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = { room, sender: userId, username, color: userColor, text: text.trim() };
    socket.emit('chat-message', msg);
    setMessages(m => [...m, { ...msg, id: 'pending-' + Date.now(), created: Date.now() }]);
    setText('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel chat-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Chat — {room}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && <p className="panel-empty">No messages yet</p>}
          {messages.map(m => (
            <div key={m.id} className={`chat-msg ${m.sender_id === userId ? 'own' : ''}`}>
              <span className="chat-msg-user" style={{ color: m.color || '#7c3aed' }}>{m.username}</span>
              <span className="chat-msg-text">{m.text}</span>
            </div>
          ))}
        </div>
        <form className="chat-input" onSubmit={send}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message..." />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}