import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Determine socket URL based on environment
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  async connect() {
    if (this.socket && this.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    const token = await AsyncStorage.getItem('token');
    
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      console.log('Socket disconnected manually');
    }
  }

  joinEvent(eventId) {
    if (this.socket && this.connected) {
      this.socket.emit('join-event', eventId);
      console.log(`Joined event room: ${eventId}`);
    }
  }

  leaveEvent(eventId) {
    if (this.socket && this.connected) {
      this.socket.emit('leave-event', eventId);
      console.log(`Left event room: ${eventId}`);
    }
  }

  onNewMessage(callback) {
    if (this.socket) {
      this.socket.off('new-message'); // Remove old listeners
      this.socket.on('new-message', callback);
    }
  }

  onMessageDeleted(callback) {
    if (this.socket) {
      this.socket.off('message-deleted'); // Remove old listeners
      this.socket.on('message-deleted', callback);
    }
  }

  onMessagePinned(callback) {
    if (this.socket) {
      this.socket.off('message-pinned'); // Remove old listeners
      this.socket.on('message-pinned', callback);
    }
  }

  onReactionUpdated(callback) {
    if (this.socket) {
      this.socket.off('reaction-updated'); // Remove old listeners
      this.socket.on('reaction-updated', callback);
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.off('new-message');
      this.socket.off('message-deleted');
      this.socket.off('message-pinned');
      this.socket.off('reaction-updated');
      this.socket.off('user-typing');
      this.socket.off('user-stopped-typing');
    }
  }

  emitTyping(eventId, userName) {
    if (this.socket && this.connected) {
      this.socket.emit('typing', { eventId, userName });
    }
  }

  emitStopTyping(eventId) {
    if (this.socket && this.connected) {
      this.socket.emit('stop-typing', { eventId });
    }
  }

  onUserTyping(callback) {
    if (this.socket) {
      this.socket.on('user-typing', callback);
    }
  }

  onUserStopTyping(callback) {
    if (this.socket) {
      this.socket.on('user-stop-typing', callback);
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }
}

export default new SocketService();
