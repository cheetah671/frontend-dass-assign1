import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput, Modal, FlatList, Image } from 'react-native';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Navbar from '../../components/Navbar';
import socketService from '../services/socketService';
import { useNotifications } from '../context/NotificationContext';

const EventDetailScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const { incrementNotification, clearNotification, setNotification, getEventNotification, getNotificationDetails } = useNotifications();
  const currentUserIdRef = useRef(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [ticketId, setTicketId] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [userRole, setUserRole] = useState('participant');
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [userIdLoaded, setUserIdLoaded] = useState(false);
  
  // Organizer-specific state
  const [analytics, setAnalytics] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, registered, cancelled
  const [organizerTab, setOrganizerTab] = useState('participants'); // participants, approvals, attendance, discussion
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [attendanceData, setAttendanceData] = useState({ scannedCount: 0, notScannedCount: 0, attendanceRate: 0, attendanceData: [] });
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [showManualOverrideModal, setShowManualOverrideModal] = useState(false);
  const [selectedParticipantForOverride, setSelectedParticipantForOverride] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  
  // Discussion Forum state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showForum, setShowForum] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [hasFeedback, setHasFeedback] = useState(false);
  const [userFeedback, setUserFeedback] = useState(null);
  const [allFeedback, setAllFeedback] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({ totalFeedback: 0, averageRating: 0, ratingDistribution: {} });
  const [feedbackFilter, setFeedbackFilter] = useState('all'); // all, 1, 2, 3, 4, 5
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  
  // Form state for registration
  const [formData, setFormData] = useState({});
  const [purchaseDetails, setPurchaseDetails] = useState({
    quantity: 1,
    size: '',
    color: '',
    variant: ''
  });
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  
  // Team registration state
  const [isTeamRegistration, setIsTeamRegistration] = useState(false);
  const [teamName, setTeamName] = useState('');

  useEffect(() => {
    const init = async () => {
      await checkUserRole(); // Wait for user ID to be set
      fetchEventDetails();
      checkRegistrationStatus();
      checkUserFeedback();
    };
    init();
  }, [eventId]);

  // Fetch unread count when user is loaded and registered/organizer
  useEffect(() => {
    if (userIdLoaded && (isRegistered || isOrganizer)) {
      console.log('✅ User loaded, fetching unread count...');
      fetchUnreadCount();
    }
  }, [userIdLoaded, isRegistered, isOrganizer]);

  // Auto-refresh unread count every 10 seconds when forum is closed
  useEffect(() => {
    if (!userIdLoaded || (!isRegistered && !isOrganizer)) return;

    // Don't auto-refresh if forum is open (organizer on discussion tab or participant with showForum)
    const isForumOpen = (isOrganizer && organizerTab === 'discussion') || (!isOrganizer && showForum);
    if (isForumOpen) return;

    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing unread count...');
      fetchUnreadCount();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [userIdLoaded, isRegistered, isOrganizer, organizerTab, showForum]);

  // Socket connection for real-time forum
  useEffect(() => {
    // Wait for user ID to be loaded before initializing socket
    if (!userIdLoaded) {
      console.log('⏳ Waiting for user ID to load before initializing socket...');
      return;
    }

    // Initialize socket if registered or organizer (regardless of forum visibility)
    if (eventId && (isRegistered || isOrganizer)) {
      console.log('🔌 Initializing socket with user ID:', currentUserIdRef.current);
      initializeSocket();
      fetchMessages();
    }

    return () => {
      if (eventId) {
        socketService.leaveEvent(eventId);
        socketService.removeAllListeners();
      }
    };
  }, [eventId, userIdLoaded, isRegistered, isOrganizer]);

  // Fetch feedback when viewing feedback tab or filter changes
  useEffect(() => {
    if (isOrganizer && organizerTab === 'feedback') {
      fetchFeedback();
    }
  }, [organizerTab, feedbackFilter]);

  const initializeSocket = async () => {
    try {
      await socketService.connect();
      socketService.joinEvent(eventId);
      console.log('🔌 Socket connected for event:', eventId);

      // Listen for new messages
      socketService.onNewMessage((message) => {
        console.log('📨 New message received:', message.authorName, '-', message.content.substring(0, 30));
        
        // Add message only if it doesn't already exist (avoid duplicates)
        setMessages((prev) => {
          const exists = prev.some(msg => msg._id === message._id || (msg._id.startsWith('temp-') && msg.content === message.content && msg.authorId === message.authorId));
          if (exists) {
            // Replace temp message with real one
            return prev.map(msg => 
              (msg._id.startsWith('temp-') && msg.content === message.content && msg.authorId === message.authorId) 
                ? message 
                : msg
            );
          }
          return [message, ...prev];
        });
        
        setMessageCount((prev) => prev + 1);
        
        // Increment notification if:
        // 1. Message is from someone else (not current user)
        // 2. Forum is currently closed
        const isFromOtherUser = message.authorId !== currentUserIdRef.current;
        const isForumClosed = !showForum && organizerTab !== 'discussion';
        
        if (isFromOtherUser && isForumClosed) {
          console.log('🔔 Notification +1');
          incrementNotification(eventId);
          setUnreadCount((prev) => prev + 1);
        }
      });

      // Listen for deleted messages
      socketService.onMessageDeleted(({ messageId }) => {
        console.log('🗑️ Message deleted:', messageId);
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
        setMessageCount((prev) => Math.max(0, prev - 1));
      });

      // Listen for pinned messages
      socketService.onMessagePinned(({ messageId, isPinned }) => {
        console.log('📌 Message pin toggled:', messageId, isPinned);
        setMessages((prev) =>
          prev.map((msg) => (msg._id === messageId ? { ...msg, isPinned } : msg))
        );
      });

      // Listen for reaction updates
      socketService.onReactionUpdated(({ messageId, reactions }) => {
        console.log('😊 Reactions updated:', messageId);
        setMessages((prev) =>
          prev.map((msg) => (msg._id === messageId ? { ...msg, reactions } : msg))
        );
      });

      // Listen for typing indicators
      socketService.onUserTyping(({ userName }) => {
        setTypingUser(userName);
        setTimeout(() => setTypingUser(null), 3000);
      });

      socketService.onUserStopTyping(() => {
        setTypingUser(null);
      });
    } catch (error) {
      console.error('❌ Socket connection error:', error);
    }
  };

  const fetchMessages = async () => {
    setLoadingMessages(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/messages/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(response.data);
      setMessageCount(response.data.length);
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (error.response?.status === 403) {
        Alert.alert('Access Denied', 'You must be registered for this event to view discussions');
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  // Fetch persistent unread count from database
  const fetchUnreadCount = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/messages/${eventId}/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const count = response.data.unreadCount;
      const messages = response.data.unreadMessages || [];
      console.log(`📬 Fetched persistent unread count: ${count}`);
      setUnreadCount(count);
      if (count > 0) {
        setNotification(eventId, count, messages);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Mark messages as read in database
  const markMessagesAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      await api.post(`/messages/${eventId}/mark-read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('✅ Marked messages as read in database');
      setUnreadCount(0);
      clearNotification(eventId);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Build tooltip text from unread messages
  const getUnreadTooltip = () => {
    const messages = getNotificationDetails(eventId);
    if (messages.length === 0) {
      return `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`;
    }
    return messages.map(msg => 
      `${msg.authorName} (${msg.authorRole}): ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`
    ).join('\n');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const userName = await AsyncStorage.getItem('userName');
      
      // Optimistically add message to UI immediately
      const tempMessage = {
        _id: 'temp-' + Date.now(),
        eventId,
        content: newMessage,
        authorId: currentUserIdRef.current,
        authorName: userName,
        authorRole: userRole,
        parentMessageId: replyingTo?._id || null,
        isAnnouncement: isOrganizer && isAnnouncement,
        isPinned: false,
        reactions: [],
        createdAt: new Date().toISOString(),
        isEventOrganizer: isOrganizer,
      };
      
      setMessages((prev) => [tempMessage, ...prev]);
      setNewMessage('');
      setReplyingTo(null);
      setIsAnnouncement(false);
      
      // Send to server
      const response = await api.post(
        '/messages',
        {
          eventId,
          content: tempMessage.content,
          parentMessageId: tempMessage.parentMessageId,
          isAnnouncement: tempMessage.isAnnouncement,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      // Replace temp message with real one from server
      setMessages((prev) => 
        prev.map(msg => msg._id === tempMessage._id ? response.data : msg)
      );
      
      // Mark as read after sending (updates read count to include this message)
      await markMessagesAsRead();
      
      socketService.emitStopTyping(eventId);
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      setMessages((prev) => prev.filter(msg => !msg._id.startsWith('temp-')));
      Alert.alert('Error', error.response?.data?.message || 'Failed to send message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (Platform.OS === 'web' && !window.confirm('Delete this message?')) return;

    try {
      // Optimistically remove from UI
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      
      const token = await AsyncStorage.getItem('token');
      await api.delete(`/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      // Revert on error
      fetchMessages();
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handlePinMessage = async (messageId) => {
    try {
      // Optimistically update UI
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
        )
      );
      
      const token = await AsyncStorage.getItem('token');
      await api.put(`/messages/${messageId}/pin`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Error pinning message:', error);
      // Revert on error
      fetchMessages();
      Alert.alert('Error', 'Failed to pin message');
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const userId = currentUserIdRef.current;
      const userName = await AsyncStorage.getItem('userName');
      
      // Optimistically update UI
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id === messageId) {
            const reactions = msg.reactions || [];
            const existingReaction = reactions.find(r => r.userId === userId && r.emoji === emoji);
            
            if (existingReaction) {
              // Remove reaction
              return {
                ...msg,
                reactions: reactions.filter(r => !(r.userId === userId && r.emoji === emoji))
              };
            } else {
              // Add reaction
              return {
                ...msg,
                reactions: [...reactions, { emoji, userId, userName }]
              };
            }
          }
          return msg;
        })
      );
      
      // Send to server
      const token = await AsyncStorage.getItem('token');
      await api.post(
        `/messages/${messageId}/react`,
        { emoji },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      console.error('Error adding reaction:', error);
      // Revert on error by refetching
      fetchMessages();
    }
  };

  const handleTyping = () => {
    const userName = userRole === 'organizer' ? 'Organizer' : 'Participant';
    socketService.emitTyping(eventId, userName);
  };

  // Feedback functions
  const checkUserFeedback = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/feedback/event/${eventId}/check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHasFeedback(response.data.hasSubmitted);
      setUserFeedback(response.data.feedback);
    } catch (error) {
      console.error('Error checking feedback:', error);
    }
  };

  const fetchFeedback = async () => {
    try {
      setLoadingFeedback(true);
      const token = await AsyncStorage.getItem('token');
      
      // Fetch feedback with optional filter
      const filterParam = feedbackFilter !== 'all' ? `?rating=${feedbackFilter}` : '';
      const feedbackResponse = await api.get(`/feedback/event/${eventId}${filterParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch statistics
      const statsResponse = await api.get(`/feedback/event/${eventId}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAllFeedback(feedbackResponse.data);
      setFeedbackStats(statsResponse.data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (feedbackRating === 0) {
      alert('Please select a rating');
      return;
    }
    
    if (feedbackComment.trim().length < 10) {
      alert('Please provide at least 10 characters of feedback');
      return;
    }

    try {
      setSubmittingFeedback(true);
      const token = await AsyncStorage.getItem('token');
      const response = await api.post(
        '/feedback',
        {
          eventId,
          rating: feedbackRating,
          comment: feedbackComment.trim()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(response.data.message);
      setFeedbackRating(0);
      setFeedbackComment('');
      checkUserFeedback();
      if (isOrganizer) fetchFeedback();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleExportFeedback = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (Platform.OS === 'web') {
        // Web: Download CSV file
        const response = await fetch(`${api.defaults.baseURL}/feedback/event/${eventId}/export`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feedback_${event.name}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        alert('Feedback exported successfully!');
      } else {
        alert('Export feature is available on web version');
      }
    } catch (error) {
      alert('Failed to export feedback');
    }
  };

  const isMessageFromEventOrganizer = (message) => {
    // Check if message author is the actual event organizer
    if (!event?.organizerid) return false;
    const eventOrgId = event.organizerid._id || event.organizerid;
    // Match against author's organizer ID, not user ID
    return message.authorRole === 'organizer' && message.isEventOrganizer;
  };

  const checkUserRole = async () => {
    const role = await AsyncStorage.getItem('userRole');
    setUserRole(role || 'participant');
    
    // Get current user ID
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('Fetching user profile...');
      const userResponse = await api.get('/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      currentUserIdRef.current = userResponse.data._id;
      console.log('✅ User ID set in ref:', currentUserIdRef.current);
      setUserIdLoaded(true); // Mark as loaded
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      setUserIdLoaded(true); // Still mark as loaded even on error
    }
  };

  const fetchEventDetails = async () => {
    try {
      const response = await api.get(`/events/${eventId}`);
      const eventData = response.data;
      setEvent(eventData);
      
      console.log('Event loaded:', eventData.name);
      console.log('Event organizer ID:', eventData.organizerid?._id);
      
      // Check if current user is the organizer
      const token = await AsyncStorage.getItem('token');
      const role = await AsyncStorage.getItem('userRole');
      
      console.log('User role:', role);
      
      if (role === 'organizer' || role === 'admin') {
        // Fetch organizer data to compare
        try {
          const meResponse = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log('User organizer ID:', meResponse.data.organizer?._id);
          
          // Check if user owns this event
          if (meResponse.data.organizer && eventData.organizerid) {
            const isOwner = eventData.organizerid._id === meResponse.data.organizer._id;
            console.log('Is owner:', isOwner);
            setIsOrganizer(isOwner);
          }
        } catch (error) {
          console.error('Error checking organizer status:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      Alert.alert('Error', 'Could not load event details');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizerData = async () => {
    if (!isOrganizer) return;
    
    setLoadingAnalytics(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Fetch analytics
      const analyticsResponse = await api.get(`/events/${eventId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(analyticsResponse.data.analytics);
      
      // Fetch participants with registration details
      const registrationsResponse = await api.get(`/registrations/event/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setParticipants(registrationsResponse.data.registrations || []);
      
    } catch (error) {
      console.error('Error fetching organizer data:', error);
      if (error.response?.status === 403) {
        console.log('User is not the organizer of this event');
        setIsOrganizer(false);
      }
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (isOrganizer) {
      fetchOrganizerData();
      if (event?.type === 'Merchandise' && organizerTab === 'approvals') {
        fetchPendingApprovals();
      }
      if (organizerTab === 'attendance') {
        fetchAttendanceData();
      }
    }
  }, [isOrganizer, organizerTab]);

  const fetchPendingApprovals = async () => {
    if (!event || event.type !== 'Merchandise') return;
    
    setLoadingApprovals(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/registrations/pending-approvals/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Pending approvals response:', response.data);
      console.log('First order payment proof:', response.data.orders?.[0]?.paymentProof?.substring(0, 50));
      setPendingApprovals(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const handleApprovePayment = async (ticketId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.put(`/registrations/approve/${ticketId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (Platform.OS === 'web') {
        window.alert(response.data.message);
      } else {
        Alert.alert('Success', response.data.message);
      }
      
      // Refresh data
      fetchPendingApprovals();
      fetchOrganizerData();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to approve payment';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleRejectPayment = async (ticketId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.put(`/registrations/reject/${ticketId}`, {
        reason: 'Payment verification failed'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (Platform.OS === 'web') {
        window.alert(response.data.message);
      } else {
        Alert.alert('Success', response.data.message);
      }
      
      // Refresh data
      fetchPendingApprovals();
      fetchOrganizerData();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to reject payment';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  // Attendance Functions
  const fetchAttendanceData = async () => {
    setLoadingAttendance(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/attendance/attendance-list/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendanceData(response.data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to fetch attendance data');
      } else {
        Alert.alert('Error', 'Failed to fetch attendance data');
      }
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleManualOverride = async () => {
    console.log('🔧 handleManualOverride called');
    console.log('Selected participant:', selectedParticipantForOverride);
    console.log('Override reason:', overrideReason);
    
    if (!selectedParticipantForOverride || !overrideReason.trim()) {
      console.log('❌ Validation failed - missing data');
      if (Platform.OS === 'web') {
        window.alert('Please provide a reason for manual override');
      } else {
        Alert.alert('Error', 'Please provide a reason for manual override');
      }
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      console.log('📤 Sending manual override request:', {
        ticketId: selectedParticipantForOverride.ticketId,
        markAsPresent: !selectedParticipantForOverride.attendance,
        reason: overrideReason
      });
      
      const response = await api.post('/attendance/manual-override', {
        ticketId: selectedParticipantForOverride.ticketId,
        markAsPresent: !selectedParticipantForOverride.attendance,
        reason: overrideReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Manual override response:', response.data);

      if (Platform.OS === 'web') {
        window.alert(response.data.message);
      } else {
        Alert.alert('Success', response.data.message);
      }

      // Reset and refresh
      setShowManualOverrideModal(false);
      setSelectedParticipantForOverride(null);
      setOverrideReason('');
      fetchAttendanceData();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to update attendance';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleExportAttendanceCSV = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/attendance/export-attendance/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-${event.name}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (Platform.OS === 'web') {
        window.alert('Attendance CSV exported successfully!');
      } else {
        Alert.alert('Success', 'Attendance CSV exported successfully!');
      }
    } catch (error) {
      console.error('Error exporting attendance CSV:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to export attendance CSV');
      } else {
        Alert.alert('Error', 'Failed to export attendance CSV');
      }
    }
  };

  const openQRScanner = () => {
    navigation.navigate('QRScanner', { 
      eventId: eventId,
      eventName: event.name 
    });
  };

  const checkRegistrationStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/registrations/status/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsRegistered(response.data.isRegistered);
      setTicketId(response.data.ticketId);
    } catch (error) {
      console.error('Error checking registration:', error);
    }
  };

  const isDeadlinePassed = () => {
    if (!event) return false;
    return new Date() > new Date(event.registrationdeadline);
  };

  const isEventFull = () => {
    if (!event || event.type !== 'Normal') return false;
    if (event.registrationLimit === 0) return false;
    return event.participants?.length >= event.registrationLimit;
  };

  const isOutOfStock = () => {
    if (!event || event.type !== 'Merchandise') return false;
    return event.stock <= 0;
  };

  const canRegister = () => {
    const registered = isRegistered;
    const deadlinePassed = isDeadlinePassed();
    const eventFull = isEventFull();
    const outOfStock = isOutOfStock();
    
    console.log('Can register check:', {
      isRegistered: registered,
      deadlinePassed,
      eventFull,
      outOfStock,
      result: !registered && !deadlinePassed && !eventFull && !outOfStock
    });
    
    if (registered) return false;
    if (deadlinePassed) return false;
    if (eventFull) return false;
    if (outOfStock) return false;
    return true;
  };

  const getBlockingMessage = () => {
    if (isRegistered) return '✅ Already Registered';
    if (isDeadlinePassed()) return '⏰ Registration Deadline Passed';
    if (isEventFull()) return '🚫 Event Full - Registration Limit Reached';
    if (isOutOfStock()) return '📦 Out of Stock';
    return null;
  };

  const handleRegister = () => {
    console.log('Register button clicked');
    console.log('Can register:', canRegister());
    console.log('Blocking message:', getBlockingMessage());
    
    if (!canRegister()) {
      Alert.alert('Cannot Register', getBlockingMessage());
      return;
    }

    // Show form if event has custom fields, is merchandise, or requires team registration
    if (event.formFields?.length > 0 || event.type === 'Merchandise' || event.allowTeamRegistration) {
      console.log('Showing registration form');
      setShowRegistrationForm(true);
    } else {
      // Direct registration for simple events
      console.log('Direct registration');
      submitRegistration();
    }
  };

  const submitRegistration = async () => {
    try {
      setRegistering(true);
      
      // Validate team name if team registration
      if (event.allowTeamRegistration && isTeamRegistration && !teamName) {
        if (Platform.OS === 'web') {
          alert('Please provide team name');
        } else {
          Alert.alert('Validation Error', 'Please provide team name');
        }
        setRegistering(false);
        return;
      }
      
      console.log('Starting registration for event:', event._id);
      
      const token = await AsyncStorage.getItem('token');
      console.log('Token retrieved:', token ? 'Yes' : 'No');

      const payload = {
        eventId: event._id,
        ...(event.type === 'Merchandise' && { purchaseDetails }),
        ...(event.formFields?.length > 0 && { formResponses: formData }),
        // Include team name if team registration
        ...(event.allowTeamRegistration && isTeamRegistration && teamName && {
          teamName
        })
      };
      
      console.log('Registration payload:', payload);

      const response = await api.post('/registrations/register', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Registration response:', response.data);

      // Update states immediately
      setIsRegistered(true);
      setTicketId(response.data.registration.ticketId);
      setShowRegistrationForm(false);
      
      // Refresh data
      await checkRegistrationStatus();
      await fetchEventDetails();

      // For merchandise requiring payment proof, navigate to upload screen
      if (response.data.requiresPaymentProof) {
        if (Platform.OS === 'web') {
          const uploadNow = window.confirm(
            `${response.data.message}\n\nWould you like to upload payment proof now?`
          );
          if (uploadNow) {
            navigation.navigate('UploadPaymentProof', { 
              ticketId: response.data.registration.ticketId,
              eventName: event.name 
            });
          }
        } else {
          Alert.alert(
            'Order Created!',
            response.data.message,
            [
              {
                text: 'Upload Payment Proof',
                onPress: () => navigation.navigate('UploadPaymentProof', { 
                  ticketId: response.data.registration.ticketId,
                  eventName: event.name 
                })
              },
              {
                text: 'Later'
              }
            ]
          );
        }
      } else {
        // Show success message for normal events
        if (Platform.OS === 'web') {
          // For web, use window.alert
          const viewTicket = window.confirm(
            `${response.data.message}\n\nWould you like to view your ticket now?`
          );
          if (viewTicket) {
            navigation.navigate('Profile');
          }
        } else {
          // For mobile, use Alert.alert
          Alert.alert(
            'Success!',
            response.data.message,
            [
              {
                text: 'View Ticket',
                onPress: () => navigation.navigate('Profile')
              },
              {
                text: 'OK'
              }
            ]
          );
        }
      }

    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Registration failed';
      console.error('Registration error:', error);
      console.error('Registration error response:', error.response?.data);
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setRegistering(false);
    }
  };

  const viewTicket = () => {
    if (ticketId) {
      navigation.navigate('Profile', { 
        screen: 'Tickets',
        params: { ticketId }
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (Platform.OS === 'web') {
        // For web, trigger download
        const response = await fetch(`${api.defaults.baseURL}/events/${eventId}/participants/export`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `participants_${event.name}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        alert('CSV exported successfully!');
      } else {
        // For mobile, show alert (CSV export is more complex on mobile)
        Alert.alert('Info', 'CSV export is available on web platform');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      if (Platform.OS === 'web') {
        alert('Failed to export CSV');
      } else {
        Alert.alert('Error', 'Failed to export CSV');
      }
    }
  };

  const handlePublishEvent = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      await api.put(`/events/${eventId}`, 
        { status: 'Published' },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (Platform.OS === 'web') {
        alert('Event published successfully! It is now visible to all users.');
      } else {
        Alert.alert('Success', 'Event published successfully!');
      }
      
      await fetchEventDetails(); // Refresh
    } catch (error) {
      console.error('Error publishing event:', error);
      const errorMsg = error.response?.data?.message || 'Failed to publish event';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  const handleCloseEvent = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      await api.put(`/events/${eventId}`, 
        { status: 'Closed' },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (Platform.OS === 'web') {
        alert('Registrations closed successfully!');
      } else {
        Alert.alert('Success', 'Registrations closed!');
      }
      
      await fetchEventDetails(); // Refresh
    } catch (error) {
      console.error('Error closing event:', error);
      const errorMsg = error.response?.data?.message || 'Failed to close registrations';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  const filteredParticipants = participants.filter(participant => {
    const matchesSearch = participant.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         participant.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const renderParticipant = ({ item }) => (
    <View style={styles.participantRow}>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{item.name || 'N/A'}</Text>
        <Text style={styles.participantEmail}>{item.email || 'N/A'}</Text>
        <View style={styles.participantMeta}>
          <Text style={styles.participantMetaText}>
            {new Date(item.registrationDate).toLocaleDateString()}
          </Text>
          <Text style={styles.participantMetaText}>{item.paymentStatus}</Text>
          <Text style={styles.participantMetaText}>
            {item.attendance ? 'Present' : 'Absent'}
          </Text>
        </View>
        {item.teamName && (
          <View style={styles.teamLeaderInfo}>
            <Text style={styles.teamLeaderLabel}>Team: {item.teamName}</Text>
          </View>
        )}
      </View>
      <View style={[styles.participantStatus, 
        item.status === 'Registered' ? styles.statusRegistered :
        item.status === 'Cancelled' ? styles.statusCancelled :
        styles.statusCompleted
      ]}>
        <Text style={styles.participantStatusText}>{item.status}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Navbar navigation={navigation} />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#8338ec" />
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Navbar navigation={navigation} />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Event not found</Text>
        </View>
      </View>
    );
  }

  // Debug: Log state before render
  console.log('=== Render State ===');
  console.log('Event:', event?.name);
  console.log('Is Registered:', isRegistered);
  console.log('Blocking Message:', getBlockingMessage());
  console.log('Can Register:', canRegister());
  console.log('Is Organizer:', isOrganizer);
  console.log('===================');

  // Organizer View
  if (isOrganizer && event) {
    return (
      <View style={styles.container}>
        <Navbar navigation={navigation} />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Event Header */}
          <View style={styles.header}>
            <View style={styles.typeContainer}>
              <View style={[styles.typeBadge, event.type === 'Merchandise' ? styles.merchBadge : styles.normalBadge]}>
                <Text style={styles.typeBadgeText}>
                  {event.type === 'Merchandise' ? 'MERCHANDISE' : 'EVENT'}
                </Text>
              </View>
              <View style={[styles.statusBadge, 
                event.status === 'Published' ? styles.publishedBadge :
                event.status === 'Draft' ? styles.draftBadge :
                event.status === 'Ongoing' ? styles.ongoingBadge :
                styles.closedBadge
              ]}>
                <Text style={styles.statusText}>{event.status}</Text>
              </View>
            </View>
            
            <Text style={styles.eventName}>{event.name}</Text>
            <Text style={styles.organizerLabel}>Organizer View</Text>
            
            {/* Action Buttons for Organizer */}
            <View style={styles.organizerActions}>
              {event.status === 'Draft' && (
                <TouchableOpacity 
                  style={styles.publishBtn}
                  onPress={async () => {
                    if (Platform.OS === 'web') {
                      if (window.confirm('Publish this event? It will be visible to all users.')) {
                        await handlePublishEvent();
                      }
                    } else {
                      Alert.alert(
                        'Publish Event',
                        'Make this event visible to all users?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Publish', onPress: handlePublishEvent }
                        ]
                      );
                    }
                  }}
                >
                  <Text style={styles.publishBtnText}>Publish Event</Text>
                </TouchableOpacity>
              )}
              
              {(event.status === 'Draft' || event.status === 'Published') && (
                <TouchableOpacity 
                  style={styles.editBtn}
                  onPress={() => navigation.navigate('CreateEvent', { eventId: event._id, editMode: true })}
                >
                  <Text style={styles.editBtnText}>Edit Event</Text>
                </TouchableOpacity>
              )}
              
              {event.status === 'Published' && (
                <TouchableOpacity 
                  style={styles.closeBtn}
                  onPress={async () => {
                    if (Platform.OS === 'web') {
                      if (window.confirm('Close registrations for this event?')) {
                        await handleCloseEvent();
                      }
                    } else {
                      Alert.alert(
                        'Close Registrations',
                        'Stop accepting new registrations?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Close', onPress: handleCloseEvent }
                        ]
                      );
                    }
                  }}
                >
                  <Text style={styles.closeBtnText}>Close Registrations</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Overview Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Overview</Text>
            
            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Start Date</Text>
                <Text style={styles.detailValue}>
                  {new Date(event.startdate).toLocaleDateString('en-US', { 
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                  })}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>End Date</Text>
                <Text style={styles.detailValue}>
                  {new Date(event.enddate).toLocaleDateString('en-US', { 
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                  })}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Eligibility</Text>
                <Text style={styles.detailValue}>{event.eligibility}</Text>
              </View>

              {event.type === 'Normal' && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Registration Fee</Text>
                  <Text style={styles.detailValue}>₹{event.registrationFee || 0}</Text>
                </View>
              )}

              {event.type === 'Merchandise' && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Price</Text>
                  <Text style={styles.detailValue}>₹{event.price || 0}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Analytics Card */}
          {analytics && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Analytics</Text>
              
              {loadingAnalytics ? (
                <ActivityIndicator size="small" color="#8338ec" />
              ) : (
                <View style={styles.analyticsContainer}>
                  <View style={styles.analyticsRow}>
                    <View style={styles.analyticsBox}>
                      <Text style={styles.analyticsNumber}>{analytics.registrations?.total || 0}</Text>
                      <Text style={styles.analyticsLabel}>Total Registrations</Text>
                    </View>
                    <View style={styles.analyticsBox}>
                      <Text style={styles.analyticsNumber}>{analytics.registrations?.active || 0}</Text>
                      <Text style={styles.analyticsLabel}>Active</Text>
                    </View>
                  </View>
                  
                  <View style={styles.analyticsRow}>
                    <View style={styles.analyticsBox}>
                      <Text style={styles.analyticsNumber}>₹{analytics.sales?.totalRevenue || 0}</Text>
                      <Text style={styles.analyticsLabel}>Revenue</Text>
                    </View>
                    <View style={styles.analyticsBox}>
                      <Text style={styles.analyticsNumber}>{analytics.attendance?.rate || '0%'}</Text>
                      <Text style={styles.analyticsLabel}>Attendance</Text>
                    </View>
                  </View>

                  {analytics.teams && analytics.teams.totalTeams > 0 && (
                    <View style={styles.teamsSection}>
                      <Text style={styles.teamsTitle}>Team Completion</Text>
                      <Text style={styles.teamsText}>
                        Complete: {analytics.teams.completeTeams} | Incomplete: {analytics.teams.incompleteTeams}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Tabs for Merchandise - Participants vs Payment Approvals */}
          {event.type === 'Merchandise' && (
            <View style={styles.tabsContainer}>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'participants' && styles.activeTab]}
                onPress={() => setOrganizerTab('participants')}
              >
                <Text style={[styles.tabText, organizerTab === 'participants' && styles.activeTabText]}>
                  Participants
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'approvals' && styles.activeTab]}
                onPress={() => setOrganizerTab('approvals')}
              >
                <Text style={[styles.tabText, organizerTab === 'approvals' && styles.activeTabText]}>
                  Payment Approvals {pendingApprovals.length > 0 && `(${pendingApprovals.length})`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'attendance' && styles.activeTab]}
                onPress={() => setOrganizerTab('attendance')}
              >
                <Text style={[styles.tabText, organizerTab === 'attendance' && styles.activeTabText]}>
                  Attendance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'discussion' && styles.activeTab]}
                onPress={async () => {
                  setOrganizerTab('discussion');
                  if (unreadCount > 0) {
                    await markMessagesAsRead();
                  }
                }}
              >
                <View style={styles.tabWithBadge}>
                  <Text style={[styles.tabText, organizerTab === 'discussion' && styles.activeTabText]}>
                    Discussion {unreadCount > 0 && `(${unreadCount})`}
                  </Text>
                  {unreadCount > 0 && (
                    <View 
                      style={styles.unreadBadge}
                      {...(Platform.OS === 'web' && { title: getUnreadTooltip() })}
                    >
                      <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'feedback' && styles.activeTab]}
                onPress={() => setOrganizerTab('feedback')}
              >
                <Text style={[styles.tabText, organizerTab === 'feedback' && styles.activeTabText]}>
                  Feedback {feedbackStats.totalFeedback > 0 && `(${feedbackStats.totalFeedback})`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tabs for Non-Merchandise - Just Participants and Attendance */}
          {event.type !== 'Merchandise' && (
            <View style={styles.tabsContainer}>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'participants' && styles.activeTab]}
                onPress={() => setOrganizerTab('participants')}
              >
                <Text style={[styles.tabText, organizerTab === 'participants' && styles.activeTabText]}>
                  Participants
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'attendance' && styles.activeTab]}
                onPress={() => setOrganizerTab('attendance')}
              >
                <Text style={[styles.tabText, organizerTab === 'attendance' && styles.activeTabText]}>
                  Attendance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'discussion' && styles.activeTab]}
                onPress={async () => {
                  setOrganizerTab('discussion');
                  if (unreadCount > 0) {
                    await markMessagesAsRead();
                  }
                }}
              >
                <View style={styles.tabWithBadge}>
                  <Text style={[styles.tabText, organizerTab === 'discussion' && styles.activeTabText]}>
                    Discussion {unreadCount > 0 && `(${unreadCount})`}
                  </Text>
                  {unreadCount > 0 && (
                    <View 
                      style={styles.unreadBadge}
                      {...(Platform.OS === 'web' && { title: getUnreadTooltip() })}
                    >
                      <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, organizerTab === 'feedback' && styles.activeTab]}
                onPress={() => setOrganizerTab('feedback')}
              >
                <Text style={[styles.tabText, organizerTab === 'feedback' && styles.activeTabText]}>
                  Feedback {feedbackStats.totalFeedback > 0 && `(${feedbackStats.totalFeedback})`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Payment Approvals Tab */}
          {organizerTab === 'approvals' && event.type === 'Merchandise' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pending Payment Approvals</Text>
              
              {loadingApprovals ? (
                <ActivityIndicator size="large" color="#8338ec" style={{marginVertical: 20}} />
              ) : pendingApprovals.length === 0 ? (
                <View style={styles.emptyParticipants}>
                  <Text style={styles.emptyText}>No pending approvals</Text>
                </View>
              ) : (
                <FlatList
                  data={pendingApprovals}
                  renderItem={({ item }) => (
                    <View style={styles.approvalCard}>
                      <View style={styles.approvalHeader}>
                        <View>
                          <Text style={styles.approvalName}>{item.participantName}</Text>
                          <Text style={styles.approvalEmail}>{item.participantEmail}</Text>
                          <Text style={styles.approvalDate}>
                            📅 {new Date(item.registrationDate).toLocaleDateString()}
                          </Text>
                        </View>
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>⏳ Pending</Text>
                        </View>
                      </View>

                      <View style={styles.purchaseInfo}>
                        <Text style={styles.purchaseLabel}>Purchase Details:</Text>
                        {item.purchaseDetails?.quantity && (
                          <Text style={styles.purchaseText}>Quantity: {item.purchaseDetails.quantity}</Text>
                        )}
                        {item.purchaseDetails?.size && (
                          <Text style={styles.purchaseText}>Size: {item.purchaseDetails.size}</Text>
                        )}
                        {item.purchaseDetails?.color && (
                          <Text style={styles.purchaseText}>Color: {item.purchaseDetails.color}</Text>
                        )}
                      </View>

                      {/* Payment Proof Image */}
                      <View style={styles.proofContainer}>
                        <Text style={styles.proofLabel}>💳 Payment Proof:</Text>
                        {item.paymentProof ? (
                          <>
                            {/* Debug info */}
                            <Text style={{fontSize: 10, color: '#666', marginBottom: 4}}>
                              Data format: {item.paymentProof.substring(0, 20)}...
                            </Text>
                            <Image 
                              source={{ uri: item.paymentProof }} 
                              style={styles.proofImage}
                              resizeMode="contain"
                              onError={(e) => {
                                console.log('Image load error:', e.nativeEvent?.error);
                                console.log('Image URI:', item.paymentProof?.substring(0, 100));
                              }}
                              onLoad={() => console.log('Image loaded successfully for', item.ticketId)}
                            />
                          </>
                        ) : (
                          <View style={styles.noProofContainer}>
                            <Text style={styles.noProofText}>⚠️ No payment proof uploaded yet</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.approvalActions}>
                        <TouchableOpacity 
                          style={styles.approveBtn}
                          onPress={() => handleApprovePayment(item.ticketId)}
                        >
                          <Text style={styles.approveBtnText}>✓ Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.rejectBtn}
                          onPress={() => handleRejectPayment(item.ticketId)}
                        >
                          <Text style={styles.rejectBtnText}>✕ Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}

          {/* Attendance Tab */}
          {organizerTab === 'attendance' && (
            <View style={styles.card}>
              <View style={styles.attendanceHeader}>
                <Text style={styles.sectionTitle}>Attendance Tracker</Text>
                <View style={styles.attendanceActions}>
                  <TouchableOpacity style={styles.scanBtn} onPress={openQRScanner}>
                    <Text style={styles.scanBtnText}>Scan QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exportBtn} onPress={handleExportAttendanceCSV}>
                    <Text style={styles.exportBtnText}>Export</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {loadingAttendance ? (
                <ActivityIndicator size="large" color="#8338ec" style={{marginVertical: 20}} />
              ) : (
                <>
                  {/* Attendance Stats */}
                  <View style={styles.attendanceStats}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{attendanceData.scannedCount}</Text>
                      <Text style={styles.statLabel}>Present</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{attendanceData.notScannedCount}</Text>
                      <Text style={styles.statLabel}>Absent</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{attendanceData.attendanceRate}%</Text>
                      <Text style={styles.statLabel}>Rate</Text>
                    </View>
                  </View>

                  {/* Attendance Lists */}
                  <View style={styles.attendanceLists}>
                    {/* Present List */}
                    <View style={styles.attendanceSection}>
                      <Text style={styles.attendanceSectionTitle}>
                        Present ({attendanceData.scannedCount})
                      </Text>
                      {attendanceData.attendanceData
                        .filter(p => p.attendance)
                        .map(participant => (
                          <View key={participant._id} style={styles.attendanceItem}>
                            <View style={styles.attendanceInfo}>
                              <Text style={styles.attendanceName}>{participant.participantName}</Text>
                              <Text style={styles.attendanceEmail}>{participant.participantEmail}</Text>
                              {participant.attendanceTimestamp && (
                                <Text style={styles.attendanceTime}>
                                  {new Date(participant.attendanceTimestamp).toLocaleString()}
                                </Text>
                              )}
                              {participant.manualOverride && (
                                <View style={styles.overrideBadge}>
                                  <Text style={styles.overrideBadgeText}>
                                    Manual: {participant.overrideReason}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <TouchableOpacity 
                              style={styles.overrideBtn}
                              onPress={async () => {
                                // For web, use prompt
                                if (Platform.OS === 'web') {
                                  const reason = window.prompt('Enter reason for marking attendance:', 'Manual attendance update');
                                  if (reason && reason.trim()) {
                                    try {
                                      const token = await AsyncStorage.getItem('token');
                                      const response = await api.post('/attendance/manual-override', {
                                        ticketId: participant.ticketId,
                                        markAsPresent: !participant.attendance,
                                        reason: reason.trim()
                                      }, {
                                        headers: { Authorization: `Bearer ${token}` }
                                      });
                                      window.alert(response.data.message);
                                      fetchAttendanceData();
                                    } catch (error) {
                                      const msg = error.response?.data?.message || 'Failed to update attendance';
                                      window.alert(msg);
                                    }
                                  }
                                } else {
                                  setSelectedParticipantForOverride(participant);
                                  setShowManualOverrideModal(true);
                                }
                              }}
                            >
                              <Text style={styles.overrideBtnText}>✏️</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                    </View>

                    {/* Absent List */}
                    <View style={styles.attendanceSection}>
                      <Text style={styles.attendanceSectionTitle}>
                        Absent ({attendanceData.notScannedCount})
                      </Text>
                      {attendanceData.attendanceData
                        .filter(p => !p.attendance)
                        .map(participant => (
                          <View key={participant._id} style={styles.attendanceItem}>
                            <View style={styles.attendanceInfo}>
                              <Text style={styles.attendanceName}>{participant.participantName}</Text>
                              <Text style={styles.attendanceEmail}>{participant.participantEmail}</Text>
                            </View>
                            <TouchableOpacity 
                              style={styles.markPresentBtn}
                              onPress={async () => {
                                console.log('✓ Mark button clicked for:', participant.participantName);
                                console.log('Participant data:', participant);
                                
                                // For web, use prompt
                                if (Platform.OS === 'web') {
                                  const reason = window.prompt('Enter reason for marking attendance:', 'Verified manually');
                                  if (reason && reason.trim()) {
                                    try {
                                      const token = await AsyncStorage.getItem('token');
                                      const response = await api.post('/attendance/manual-override', {
                                        ticketId: participant.ticketId,
                                        markAsPresent: !participant.attendance,
                                        reason: reason.trim()
                                      }, {
                                        headers: { Authorization: `Bearer ${token}` }
                                      });
                                      window.alert(response.data.message);
                                      fetchAttendanceData();
                                    } catch (error) {
                                      const msg = error.response?.data?.message || 'Failed to update attendance';
                                      window.alert(msg);
                                    }
                                  }
                                } else {
                                  setSelectedParticipantForOverride(participant);
                                  setShowManualOverrideModal(true);
                                }
                              }}
                            >
                              <Text style={styles.markPresentBtnText}>✓ Mark</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Discussion Forum Tab */}
          {organizerTab === 'discussion' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Discussion Forum</Text>
              
              {loadingMessages ? (
                <ActivityIndicator size="large" color="#667eea" style={{marginVertical: 20}} />
              ) : (
                <View style={styles.forumContent}>
                  {/* Message Input */}
                  <View style={styles.messageInputContainer}>
                    {replyingTo && (
                      <View style={styles.replyingToBar}>
                        <Text style={styles.replyingToText}>
                          Replying to {replyingTo.authorName}
                        </Text>
                        <TouchableOpacity onPress={() => setReplyingTo(null)}>
                          <Text style={styles.cancelReplyText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {!replyingTo && (
                      <TouchableOpacity
                        style={styles.announcementToggle}
                        onPress={() => setIsAnnouncement(!isAnnouncement)}
                      >
                        <Text style={styles.announcementToggleText}>
                          {isAnnouncement ? '📢 Announcement' : '💬 Regular Message'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.messageInput}
                        placeholder="Type your message..."
                        placeholderTextColor="#999"
                        value={newMessage}
                        onChangeText={(text) => {
                          setNewMessage(text);
                          if (text.length > 0) {
                            handleTyping();
                          }
                        }}
                        multiline
                        maxLength={2000}
                      />
                      <TouchableOpacity
                        style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                        onPress={handleSendMessage}
                        disabled={!newMessage.trim()}
                      >
                        <Text style={styles.sendButtonText}>➤</Text>
                      </TouchableOpacity>
                    </View>

                    {typingUser && (
                      <Text style={styles.typingIndicator}>{typingUser} is typing...</Text>
                    )}
                  </View>

                  {/* Messages List */}
                  <View style={styles.messagesList}>
                    {messages.length === 0 ? (
                      <View style={styles.emptyMessages}>
                        <Text style={styles.emptyMessagesText}>
                          No messages yet. Start the conversation!
                        </Text>
                      </View>
                    ) : (
                      messages.map((message) => (
                        <View
                          key={message._id}
                          style={[
                            styles.messageCard,
                            message.isPinned && styles.pinnedMessage,
                            message.isAnnouncement && styles.announcementMessage,
                          ]}
                        >
                          {/* Message Header */}
                          <View style={styles.messageHeader}>
                            <View style={styles.messageAuthorInfo}>
                              <Text style={styles.messageAuthorName}>
                                {message.authorName}
                              </Text>
                              <View
                                style={[
                                  styles.roleTag,
                                  message.isEventOrganizer && styles.organizerTag,
                                  message.authorRole === 'admin' && styles.adminTag,
                                ]}
                              >
                                <Text style={styles.roleTagText}>
                                  {message.isEventOrganizer
                                    ? '🎪 Organizer'
                                    : message.authorRole === 'admin'
                                    ? '👑 Admin'
                                    : '👤'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.messageTime}>
                              {new Date(message.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>

                          {/* Badges */}
                          <View style={styles.messageBadges}>
                            {message.isPinned && (
                              <View style={styles.pinnedBadge}>
                                <Text style={styles.pinnedBadgeText}>📌 Pinned</Text>
                              </View>
                            )}
                            {message.isAnnouncement && (
                              <View style={styles.announcementBadge}>
                                <Text style={styles.announcementBadgeText}>📢 Announcement</Text>
                              </View>
                            )}
                          </View>

                          {/* Message Content */}
                          <Text style={styles.messageContent}>{message.content}</Text>

                          {/* Reactions */}
                          {message.reactions && message.reactions.length > 0 && (
                            <View style={styles.reactionsBar}>
                              {['👍', '❤️', '😂', '🎉', '🤔'].map((emoji) => {
                                const count = message.reactions.filter((r) => r.emoji === emoji).length;
                                if (count === 0) return null;
                                return (
                                  <TouchableOpacity
                                    key={emoji}
                                    style={styles.reactionChip}
                                    onPress={() => handleReaction(message._id, emoji)}
                                  >
                                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                                    <Text style={styles.reactionCount}>{count}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}

                          {/* Message Actions */}
                          <View style={styles.messageActions}>
                            <TouchableOpacity
                              style={styles.messageAction}
                              onPress={() => setReplyingTo(message)}
                            >
                              <Text style={styles.messageActionText}>💬 Reply</Text>
                            </TouchableOpacity>

                            {/* Quick Reactions */}
                            {['👍', '❤️', '😂', '🎉', '🤔'].map((emoji) => (
                              <TouchableOpacity
                                key={emoji}
                                style={styles.messageAction}
                                onPress={() => handleReaction(message._id, emoji)}
                              >
                                <Text style={styles.messageActionText}>{emoji}</Text>
                              </TouchableOpacity>
                            ))}

                            {/* Moderator Actions - Always visible for organizers */}
                            <TouchableOpacity
                              style={styles.messageAction}
                              onPress={() => handlePinMessage(message._id)}
                            >
                              <Text style={styles.messageActionText}>
                                {message.isPinned ? '📌 Unpin' : '📌 Pin'}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.messageAction}
                              onPress={() => handleDeleteMessage(message._id)}
                            >
                              <Text style={[styles.messageActionText, styles.deleteAction]}>
                                🗑️ Delete
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Feedback Tab */}
          {organizerTab === 'feedback' && (
            <View style={styles.card}>
              <View style={styles.participantsHeader}>
                <Text style={styles.sectionTitle}>⭐ Event Feedback</Text>
                <TouchableOpacity style={styles.exportBtn} onPress={handleExportFeedback}>
                  <Text style={styles.exportBtnText}>📥 Export CSV</Text>
                </TouchableOpacity>
              </View>

              {/* Feedback Statistics */}
              {feedbackStats.totalFeedback > 0 && (
                <View style={styles.statsCard}>
                  <View style={styles.statRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{feedbackStats.totalFeedback}</Text>
                      <Text style={styles.statLabel}>Total Feedback</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{feedbackStats.averageRating.toFixed(1)} ⭐</Text>
                      <Text style={styles.statLabel}>Average Rating</Text>
                    </View>
                  </View>
                  
                  <View style={styles.ratingDistribution}>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <View key={star} style={styles.ratingRow}>
                        <Text style={styles.starLabel}>{star} ⭐</Text>
                        <View style={styles.ratingBar}>
                          <View 
                            style={[
                              styles.ratingBarFill, 
                              { width: `${(feedbackStats.ratingDistribution[star] / feedbackStats.totalFeedback) * 100}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.ratingCount}>
                          {feedbackStats.ratingDistribution[star] || 0}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Filter by Rating */}
              <View style={styles.filterContainer}>
                <Text style={styles.filterLabel}>Filter by rating:</Text>
                <View style={styles.filterButtons}>
                  {['all', '5', '4', '3', '2', '1'].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.filterBtn,
                        feedbackFilter === rating && styles.filterBtnActive
                      ]}
                      onPress={() => setFeedbackFilter(rating)}
                    >
                      <Text style={[
                        styles.filterBtnText,
                        feedbackFilter === rating && styles.filterBtnTextActive
                      ]}>
                        {rating === 'all' ? 'All' : `${rating}⭐`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Feedback List */}
              {loadingFeedback ? (
                <ActivityIndicator size="large" color="#8338ec" style={{ marginTop: 20 }} />
              ) : allFeedback.length === 0 ? (
                <View style={styles.emptyParticipants}>
                  <Text style={styles.emptyText}>No feedback yet</Text>
                </View>
              ) : (
                <ScrollView style={styles.feedbackList}>
                  {allFeedback.map((feedback) => (
                    <View key={feedback._id} style={styles.feedbackCard}>
                      <View style={styles.feedbackHeader}>
                        <View style={styles.starsContainer}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Text key={star} style={styles.star}>
                              {star <= feedback.rating ? '⭐' : '☆'}
                            </Text>
                          ))}
                        </View>
                        <Text style={styles.feedbackDate}>
                          {new Date(feedback.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.feedbackComment}>{feedback.comment}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Feedback Tab */}
          {organizerTab === 'feedback' && (
            <View style={styles.card}>
              <View style={styles.feedbackHeader}>
                <Text style={styles.sectionTitle}>⭐ Event Feedback</Text>
                <TouchableOpacity style={styles.exportBtn} onPress={handleExportFeedback}>
                  <Text style={styles.exportBtnText}>📊 Export CSV</Text>
                </TouchableOpacity>
              </View>

              {/* Feedback Statistics */}
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{feedbackStats.totalFeedback}</Text>
                  <Text style={styles.statLabel}>Total Feedback</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNumber, styles.ratingNumber]}>
                    {feedbackStats.averageRating.toFixed(1)} ⭐
                  </Text>
                  <Text style={styles.statLabel}>Average Rating</Text>
                </View>
              </View>

              {/* Rating Distribution */}
              {feedbackStats.totalFeedback > 0 && (
                <View style={styles.ratingDistribution}>
                  <Text style={styles.subsectionTitle}>Rating Distribution</Text>
                  {[5, 4, 3, 2, 1].map(rating => {
                    const count = feedbackStats.ratingDistribution[rating] || 0;
                    const percentage = feedbackStats.totalFeedback > 0 
                      ? (count / feedbackStats.totalFeedback * 100).toFixed(0) 
                      : 0;
                    return (
                      <View key={rating} style={styles.ratingBar}>
                        <Text style={styles.ratingLabel}>{rating} ⭐</Text>
                        <View style={styles.barContainer}>
                          <View style={[styles.barFill, { width: `${percentage}%` }]} />
                        </View>
                        <Text style={styles.ratingCount}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Filter Buttons */}
              <View style={styles.filterContainer}>
                <Text style={styles.subsectionTitle}>Filter by Rating:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {['all', '5', '4', '3', '2', '1'].map(filter => (
                    <TouchableOpacity
                      key={filter}
                      style={[
                        styles.filterButton,
                        feedbackFilter === filter && styles.filterButtonActive
                      ]}
                      onPress={() => setFeedbackFilter(filter)}
                    >
                      <Text style={[
                        styles.filterButtonText,
                        feedbackFilter === filter && styles.filterButtonTextActive
                      ]}>
                        {filter === 'all' ? 'All' : `${filter} ⭐`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Feedback List */}
              {loadingFeedback ? (
                <ActivityIndicator size="large" color="#667eea" style={{marginVertical: 20}} />
              ) : allFeedback.length === 0 ? (
                <View style={styles.emptyFeedback}>
                  <Text style={styles.emptyFeedbackText}>
                    {feedbackFilter === 'all' 
                      ? 'No feedback received yet' 
                      : `No ${feedbackFilter}-star feedback`}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.feedbackList}>
                  {allFeedback.map(feedback => (
                    <View key={feedback._id} style={styles.feedbackCard}>
                      <View style={styles.feedbackRatingRow}>
                        <View style={styles.starsDisplay}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <Text key={star} style={styles.starIcon}>
                              {star <= feedback.rating ? '⭐' : '☆'}
                            </Text>
                          ))}
                        </View>
                        <Text style={styles.feedbackDate}>
                          {new Date(feedback.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.feedbackComment}>{feedback.comment}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Participants Card */}
          {organizerTab === 'participants' && (
          <View style={styles.card}>
            <View style={styles.participantsHeader}>
              <Text style={styles.sectionTitle}>Participants ({participants.length})</Text>
              <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
                <Text style={styles.exportBtnText}>Export CSV</Text>
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {filteredParticipants.length === 0 ? (
              <View style={styles.emptyParticipants}>
                <Text style={styles.emptyText}>No participants yet</Text>
              </View>
            ) : (
              <FlatList
                data={filteredParticipants}
                renderItem={renderParticipant}
                keyExtractor={(item) => item._id}
                scrollEnabled={false}
              />
            )}
          </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Participant View (existing code)
  return (
    <View style={styles.container}>
      <Navbar navigation={navigation} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Event Header */}
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <View style={[styles.typeBadge, event.type === 'Merchandise' ? styles.merchBadge : styles.normalBadge]}>
              <Text style={styles.typeBadgeText}>
                {event.type === 'Merchandise' ? '🛍️ MERCHANDISE' : '🎉 EVENT'}
              </Text>
            </View>
            {isRegistered && (
              <View style={styles.registeredBadge}>
                <Text style={styles.registeredBadgeText}>✓ REGISTERED</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.eventName}>{event.name}</Text>
          
          <View style={styles.organizerInfo}>
            <Text style={styles.organizerText}>
              🎪 Organized by: <Text style={styles.organizerName}>{event.organizerid?.name || 'Unknown'}</Text>
            </Text>
          </View>
        </View>

        {/* Event Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📋 Event Details</Text>
          
          <Text style={styles.description}>{event.description}</Text>
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>📅 Start Date</Text>
              <Text style={styles.detailValue}>
                {new Date(event.startdate).toLocaleDateString('en-US', { 
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                })}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>📅 End Date</Text>
              <Text style={styles.detailValue}>
                {new Date(event.enddate).toLocaleDateString('en-US', { 
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                })}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>⏰ Registration Deadline</Text>
              <Text style={[styles.detailValue, isDeadlinePassed() && styles.expiredText]}>
                {new Date(event.registrationdeadline).toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                })}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>🎯 Eligibility</Text>
              <Text style={styles.detailValue}>{event.eligibility}</Text>
            </View>

            {event.type === 'Normal' && event.registrationLimit > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>👥 Registration Limit</Text>
                <Text style={[styles.detailValue, isEventFull() && styles.fullText]}>
                  {event.participants?.length || 0} / {event.registrationLimit}
                  {isEventFull() && ' (FULL)'}
                </Text>
              </View>
            )}

            {event.type === 'Normal' && event.registrationFee > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>💰 Registration Fee</Text>
                <Text style={styles.detailValue}>₹{event.registrationFee}</Text>
              </View>
            )}

            {event.type === 'Merchandise' && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>💰 Price</Text>
                  <Text style={styles.detailValue}>₹{event.price}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>📦 Stock Available</Text>
                  <Text style={[styles.detailValue, isOutOfStock() && styles.outOfStockText]}>
                    {event.stock} {isOutOfStock() && '(OUT OF STOCK)'}
                  </Text>
                </View>

                {event.purchaseLimit > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🛒 Purchase Limit</Text>
                    <Text style={styles.detailValue}>{event.purchaseLimit} per person</Text>
                  </View>
                )}
              </>
            )}

            {event.eventTags?.length > 0 && (
              <View style={styles.tagsContainer}>
                <Text style={styles.detailLabel}>🏷️ Tags</Text>
                <View style={styles.tagsRow}>
                  {event.eventTags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Registration Button */}
        <View style={styles.actionContainer}>
          {getBlockingMessage() ? (
            <View style={[styles.blockingMessage, isRegistered && styles.successMessage]}>
              <Text style={[styles.blockingText, isRegistered && styles.successText]}>
                {getBlockingMessage()}
              </Text>
              {isRegistered && ticketId && (
                <TouchableOpacity style={styles.viewTicketBtn} onPress={viewTicket}>
                  <Text style={styles.viewTicketBtnText}>View Ticket</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.registerBtn, !canRegister() && styles.disabledBtn]} 
              onPress={() => {
                console.log('Button pressed!');
                handleRegister();
              }}
              disabled={!canRegister()}
              activeOpacity={0.7}
            >
              <Text style={styles.registerBtnText}>
                {event.type === 'Merchandise' ? '🛍️ Purchase Now' : '✓ Register Now'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Discussion Forum Section */}
        {(isRegistered || isOrganizer) && (
          <View style={styles.forumSection}>
            <TouchableOpacity 
              style={styles.forumHeader}
              onPress={async () => {
                if (!showForum && unreadCount > 0) {
                  await markMessagesAsRead();
                }
                setShowForum(!showForum);
              }}
            >
              <View style={styles.forumHeaderLeft}>
                <Text style={styles.forumTitle}>Discussion Forum</Text>
                {unreadCount > 0 && (
                  <View 
                    style={styles.messageBadge}
                    {...(Platform.OS === 'web' && { title: getUnreadTooltip() })}
                  >
                    <Text style={styles.messageBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.forumToggle}>{showForum ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            
            {/* Always show button for testing */}
            {!showForum && (
              <TouchableOpacity 
                style={styles.markReadButton}
                onPress={async () => {
                  console.log('Button clicked! unreadCount:', unreadCount);
                  if (unreadCount > 0) {
                    await markMessagesAsRead();
                  }
                  setShowForum(true);
                }}
              >
                <Text style={styles.markReadButtonText}>
                  {unreadCount > 0 ? `Clear ${unreadCount} Notification${unreadCount > 1 ? 's' : ''}` : 'Open Discussion Forum'}
                </Text>
              </TouchableOpacity>
            )}

            {showForum && (
              <View style={styles.forumContent}>
                {loadingMessages ? (
                  <ActivityIndicator size="large" color="#667eea" />
                ) : (
                  <>
                    {/* Message Input */}
                    <View style={styles.messageInputContainer}>
                      {replyingTo && (
                        <View style={styles.replyingToBar}>
                          <Text style={styles.replyingToText}>
                            Replying to {replyingTo.authorName}
                          </Text>
                          <TouchableOpacity onPress={() => setReplyingTo(null)}>
                            <Text style={styles.cancelReplyText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      
                      {isOrganizer && !replyingTo && (
                        <TouchableOpacity
                          style={styles.announcementToggle}
                          onPress={() => setIsAnnouncement(!isAnnouncement)}
                        >
                          <Text style={styles.announcementToggleText}>
                            {isAnnouncement ? '📢 Announcement' : '💬 Regular Message'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.messageInput}
                          placeholder="Type your message..."
                          placeholderTextColor="#999"
                          value={newMessage}
                          onChangeText={(text) => {
                            setNewMessage(text);
                            if (text.length > 0) {
                              handleTyping();
                            }
                          }}
                          multiline
                          maxLength={2000}
                        />
                        <TouchableOpacity
                          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                          onPress={handleSendMessage}
                          disabled={!newMessage.trim()}
                        >
                          <Text style={styles.sendButtonText}>➤</Text>
                        </TouchableOpacity>
                      </View>

                      {typingUser && (
                        <Text style={styles.typingIndicator}>{typingUser} is typing...</Text>
                      )}
                    </View>

                    {/* Messages List */}
                    <View style={styles.messagesList}>
                      {messages.length === 0 ? (
                        <View style={styles.emptyMessages}>
                          <Text style={styles.emptyMessagesText}>
                            No messages yet. Start the conversation!
                          </Text>
                        </View>
                      ) : (
                        messages
                          .filter(msg => !msg.parentMessageId) // Only show top-level messages
                          .map((message) => {
                            const replies = messages.filter(m => m.parentMessageId === message._id);
                            return (
                              <View key={message._id}>
                                {/* Main Message */}
                                <View
                                  style={[
                                    styles.messageCard,
                                    message.isPinned && styles.pinnedMessage,
                                    message.isAnnouncement && styles.announcementMessage,
                                  ]}
                                >
                                  {/* Message Header */}
                                  <View style={styles.messageHeader}>
                                    <View style={styles.messageAuthorInfo}>
                                      <Text style={styles.messageAuthorName}>
                                        {message.authorName}
                                      </Text>
                                      <View
                                        style={[
                                          styles.roleTag,
                                          message.isEventOrganizer && styles.organizerTag,
                                          message.authorRole === 'admin' && styles.adminTag,
                                        ]}
                                      >
                                        <Text style={styles.roleTagText}>
                                          {message.isEventOrganizer
                                            ? '🎪 Organizer'
                                            : message.authorRole === 'admin'
                                            ? '👑 Admin'
                                            : '👤'}
                                        </Text>
                                      </View>
                                    </View>
                                    <Text style={styles.messageTime}>
                                      {new Date(message.createdAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </Text>
                                  </View>

                                  {/* Badges */}
                                  <View style={styles.messageBadges}>
                                    {message.isPinned && (
                                      <View style={styles.pinnedBadge}>
                                        <Text style={styles.pinnedBadgeText}>📌 Pinned</Text>
                                      </View>
                                    )}
                                    {message.isAnnouncement && (
                                      <View style={styles.announcementBadge}>
                                        <Text style={styles.announcementBadgeText}>📢 Announcement</Text>
                                      </View>
                                    )}
                                  </View>

                                  {/* Message Content */}
                                  <Text style={styles.messageContent}>{message.content}</Text>

                                  {/* Reactions */}
                                  {message.reactions && message.reactions.length > 0 && (
                                    <View style={styles.reactionsBar}>
                                      {['👍', '❤️', '😂', '🎉', '🤔'].map((emoji) => {
                                        const count = message.reactions.filter((r) => r.emoji === emoji).length;
                                        if (count === 0) return null;
                                        return (
                                          <TouchableOpacity
                                            key={emoji}
                                            style={styles.reactionChip}
                                            onPress={() => handleReaction(message._id, emoji)}
                                          >
                                            <Text style={styles.reactionEmoji}>{emoji}</Text>
                                            <Text style={styles.reactionCount}>{count}</Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  )}

                                  {/* Message Actions */}
                                  <View style={styles.messageActions}>
                                    <TouchableOpacity
                                      style={styles.messageAction}
                                      onPress={() => setReplyingTo(message)}
                                    >
                                      <Text style={styles.messageActionText}>
                                        💬 Reply {replies.length > 0 && `(${replies.length})`}
                                      </Text>
                                    </TouchableOpacity>

                                    {/* Quick Reactions */}
                                    {['👍', '❤️', '😂', '🎉', '🤔'].map((emoji) => (
                                      <TouchableOpacity
                                        key={emoji}
                                        style={styles.messageAction}
                                        onPress={() => handleReaction(message._id, emoji)}
                                      >
                                        <Text style={styles.messageActionText}>{emoji}</Text>
                                      </TouchableOpacity>
                                    ))}

                                    {/* Moderator Actions */}
                                    {isOrganizer && (
                                      <>
                                        <TouchableOpacity
                                          style={styles.messageAction}
                                          onPress={() => handlePinMessage(message._id)}
                                        >
                                          <Text style={styles.messageActionText}>
                                            {message.isPinned ? '📌 Unpin' : '📌 Pin'}
                                          </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={styles.messageAction}
                                          onPress={() => handleDeleteMessage(message._id)}
                                        >
                                          <Text style={[styles.messageActionText, styles.deleteAction]}>
                                            🗑️ Delete
                                          </Text>
                                        </TouchableOpacity>
                                      </>
                                    )}
                                  </View>
                                </View>

                                {/* Threaded Replies */}
                                {replies.length > 0 && (
                                  <View style={styles.repliesContainer}>
                                    {replies.map((reply) => (
                                      <View key={reply._id} style={styles.replyCard}>
                                        <View style={styles.replyIndicator} />
                                        <View style={styles.replyContent}>
                                          <View style={styles.messageHeader}>
                                            <View style={styles.messageAuthorInfo}>
                                              <Text style={styles.replyAuthorName}>{reply.authorName}</Text>
                                              <View
                                                style={[
                                                  styles.roleTag,
                                                  reply.isEventOrganizer && styles.organizerTag,
                                                ]}
                                              >
                                                <Text style={styles.roleTagText}>
                                                  {reply.isEventOrganizer ? '🎪' : '👤'}
                                                </Text>
                                              </View>
                                            </View>
                                            <Text style={styles.replyTime}>
                                              {new Date(reply.createdAt).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </Text>
                                          </View>
                                          <Text style={styles.replyContentText}>{reply.content}</Text>
                                          
                                          {/* Reply Reactions */}
                                          {reply.reactions && reply.reactions.length > 0 && (
                                            <View style={styles.reactionsBar}>
                                              {['👍', '❤️', '😂', '🎉', '🤔'].map((emoji) => {
                                                const count = reply.reactions.filter((r) => r.emoji === emoji).length;
                                                if (count === 0) return null;
                                                return (
                                                  <TouchableOpacity
                                                    key={emoji}
                                                    style={styles.reactionChip}
                                                    onPress={() => handleReaction(reply._id, emoji)}
                                                  >
                                                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                                                    <Text style={styles.reactionCount}>{count}</Text>
                                                  </TouchableOpacity>
                                                );
                                              })}
                                            </View>
                                          )}

                                          {/* Reply Actions */}
                                          <View style={styles.messageActions}>
                                            {['👍', '❤️', '😂'].map((emoji) => (
                                              <TouchableOpacity
                                                key={emoji}
                                                style={styles.messageAction}
                                                onPress={() => handleReaction(reply._id, emoji)}
                                              >
                                                <Text style={styles.messageActionText}>{emoji}</Text>
                                              </TouchableOpacity>
                                            ))}
                                            {isOrganizer && (
                                              <TouchableOpacity
                                                style={styles.messageAction}
                                                onPress={() => handleDeleteMessage(reply._id)}
                                              >
                                                <Text style={[styles.messageActionText, styles.deleteAction]}>
                                                  🗑️
                                                </Text>
                                              </TouchableOpacity>
                                            )}
                                          </View>
                                        </View>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            );
                          })
                      )}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Participant Feedback Section */}
        {!isOrganizer && isRegistered && event && (
          <View style={styles.feedbackSection}>
            <TouchableOpacity
              style={styles.feedbackToggle}
              onPress={() => setShowFeedbackForm(!showFeedbackForm)}
            >
              <Text style={styles.feedbackToggleText}>
                {hasFeedback ? '✅ You have submitted feedback' : '⭐ Submit Event Feedback'}
              </Text>
              <Text style={styles.toggleIcon}>{showFeedbackForm ? '▼' : '▶'}</Text>
            </TouchableOpacity>

            {showFeedbackForm && (
              <View style={styles.feedbackForm}>
                {hasFeedback ? (
                  <View style={styles.submittedFeedback}>
                    <Text style={styles.submittedTitle}>Your Feedback:</Text>
                    <View style={styles.starsContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text key={star} style={styles.star}>
                          {star <= userFeedback.rating ? '⭐' : '☆'}
                        </Text>
                      ))}
                    </View>
                    <Text style={styles.submittedComment}>{userFeedback.comment}</Text>
                    <Text style={styles.submittedDate}>
                      Submitted: {new Date(userFeedback.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.feedbackFormTitle}>Rate Your Experience</Text>
                    <Text style={styles.feedbackFormSubtitle}>
                      Your feedback is anonymous and helps improve future events
                    </Text>

                    {/* Star Rating */}
                    <View style={styles.ratingSelector}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          onPress={() => setFeedbackRating(star)}
                          style={styles.starButton}
                        >
                          <Text style={styles.starLarge}>
                            {star <= feedbackRating ? '⭐' : '☆'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {feedbackRating > 0 && (
                      <Text style={styles.ratingText}>
                        {feedbackRating === 5 ? 'Excellent!' : 
                         feedbackRating === 4 ? 'Great!' : 
                         feedbackRating === 3 ? 'Good' : 
                         feedbackRating === 2 ? 'Fair' : 
                         'Needs Improvement'}
                      </Text>
                    )}

                    {/* Comment TextArea */}
                    <Text style={styles.commentLabel}>Your Comments (minimum 10 characters)</Text>
                    <TextInput
                      style={styles.commentInput}
                      multiline
                      numberOfLines={4}
                      placeholder="Share your experience, suggestions, or concerns..."
                      placeholderTextColor="#999"
                      value={feedbackComment}
                      onChangeText={setFeedbackComment}
                      textAlignVertical="top"
                    />

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[
                        styles.submitFeedbackBtn,
                        (feedbackRating === 0 || feedbackComment.length < 10 || submittingFeedback) && styles.submitFeedbackBtnDisabled
                      ]}
                      onPress={handleSubmitFeedback}
                      disabled={feedbackRating === 0 || feedbackComment.length < 10 || submittingFeedback}
                    >
                      <Text style={styles.submitFeedbackBtnText}>
                        {submittingFeedback ? '⏳ Submitting...' : '📨 Submit Feedback'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Registration Form Modal */}
      <Modal
        visible={showRegistrationForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRegistrationForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {event.type === 'Merchandise' ? 'Purchase Details' : 'Registration Form'}
              </Text>

              {/* Merchandise Details */}
              {event.type === 'Merchandise' && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={String(purchaseDetails.quantity)}
                    onChangeText={(text) => setPurchaseDetails({...purchaseDetails, quantity: parseInt(text) || 1})}
                    placeholder="1"
                  />

                  {event.itemDetails?.sizes?.length > 0 && (
                    <>
                      <Text style={styles.formLabel}>Size</Text>
                      <View style={styles.optionsRow}>
                        {event.itemDetails.sizes.map((size) => (
                          <TouchableOpacity
                            key={size}
                            style={[styles.optionBtn, purchaseDetails.size === size && styles.optionBtnSelected]}
                            onPress={() => setPurchaseDetails({...purchaseDetails, size})}
                          >
                            <Text style={[styles.optionText, purchaseDetails.size === size && styles.optionTextSelected]}>
                              {size}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {event.itemDetails?.colors?.length > 0 && (
                    <>
                      <Text style={styles.formLabel}>Color</Text>
                      <View style={styles.optionsRow}>
                        {event.itemDetails.colors.map((color) => (
                          <TouchableOpacity
                            key={color}
                            style={[styles.optionBtn, purchaseDetails.color === color && styles.optionBtnSelected]}
                            onPress={() => setPurchaseDetails({...purchaseDetails, color})}
                          >
                            <Text style={[styles.optionText, purchaseDetails.color === color && styles.optionTextSelected]}>
                              {color}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Total Amount:</Text>
                    <Text style={styles.totalAmount}>₹{event.price * purchaseDetails.quantity}</Text>
                  </View>
                </View>
              )}

              {/* Custom Form Fields */}
              {event.formFields?.map((field, index) => (
                <View key={index} style={styles.formSection}>
                  <Text style={styles.formLabel}>
                    {field.fieldName} {field.required && '*'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter ${field.fieldName}`}
                    value={formData[field.fieldName] || ''}
                    onChangeText={(text) => setFormData({...formData, [field.fieldName]: text})}
                  />
                </View>
              ))}

              {/* Team Registration Option */}
              {event.allowTeamRegistration && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionHeader}>Registration Type</Text>
                  
                  <View style={styles.radioGroup}>
                    <TouchableOpacity 
                      style={styles.radioOption}
                      onPress={() => {
                        setIsTeamRegistration(false);
                        setTeamName('');
                      }}
                    >
                      <View style={styles.radioCircle}>
                        {!isTeamRegistration && <View style={styles.radioSelected} />}
                      </View>
                      <Text style={styles.radioLabel}>Individual</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.radioOption}
                      onPress={() => setIsTeamRegistration(true)}
                    >
                      <View style={styles.radioCircle}>
                        {isTeamRegistration && <View style={styles.radioSelected} />}
                      </View>
                      <Text style={styles.radioLabel}>Team</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {isTeamRegistration && (
                    <View>
                      <Text style={styles.formLabel}>Team Name *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your team name"
                        value={teamName}
                        onChangeText={setTeamName}
                      />
                    </View>
                  )}
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.submitBtn} 
                  onPress={submitRegistration}
                  disabled={registering}
                >
                  {registering ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {event.type === 'Merchandise' ? 'Confirm Purchase' : 'Submit Registration'}
                    </Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => setShowRegistrationForm(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Override Modal */}
      {showManualOverrideModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {console.log('📱 Modal is rendering. Visible:', showManualOverrideModal)}
            <Text style={styles.modalTitle}>
              {selectedParticipantForOverride?.attendance ? 'Mark Absent' : 'Mark Present'}
            </Text>
            
            {selectedParticipantForOverride && (
              <View style={styles.overrideInfo}>
                <Text style={styles.overrideName}>{selectedParticipantForOverride.participantName}</Text>
                <Text style={styles.overrideEmail}>{selectedParticipantForOverride.participantEmail}</Text>
                {selectedParticipantForOverride.attendance && selectedParticipantForOverride.attendanceTimestamp && (
                  <Text style={styles.overrideStatus}>
                    Currently marked present at: {new Date(selectedParticipantForOverride.attendanceTimestamp).toLocaleString()}
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.overrideLabel}>Reason for manual override:</Text>
            <TextInput
              style={styles.overrideInput}
              placeholder="Enter reason (e.g., 'Early departure', 'Network verified separately')"
              placeholderTextColor="#999"
              value={overrideReason}
              onChangeText={setOverrideReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.confirmOverrideBtn}
                onPress={handleManualOverride}
              >
                <Text style={styles.confirmOverrideBtnText}>Confirm Override</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelOverrideBtn}
                onPress={() => {
                  setShowManualOverrideModal(false);
                  setSelectedParticipantForOverride(null);
                  setOverrideReason('');
                }}
              >
                <Text style={styles.cancelOverrideBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#1a1a1a', fontSize: 18 },
  
  header: {
    padding: 20,
    paddingTop: 10,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  typeBadge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  normalBadge: { backgroundColor: '#f5f5f5' },
  merchBadge: { backgroundColor: '#f5f5f5' },
  typeBadgeText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.3
  },
  registeredBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  registeredBadgeText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.3
  },
  eventName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
    letterSpacing: 0.3
  },
  organizerInfo: {
    marginTop: 5,
  },
  organizerText: {
    color: '#666666',
    fontSize: 14,
  },
  organizerName: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  organizerLabel: {
    color: '#666666',
    fontSize: 14,
    marginBottom: 15,
  },
  organizerActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  publishBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 0,
    flex: 1,
    minWidth: 150,
  },
  publishBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 0.5
  },
  editBtn: {
    backgroundColor: '#666666',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 0,
    flex: 1,
    minWidth: 150,
  },
  editBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 0.5
  },
  closeBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 0,
    flex: 1,
    minWidth: 150,
  },
  closeBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 0.5
  },
  
  card: {
    backgroundColor: '#ffffff',
    margin: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 15,
    letterSpacing: 0.3
  },
  description: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
    marginBottom: 20,
  },
  detailsGrid: {
    gap: 15,
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 5,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  expiredText: { color: '#1a1a1a' },
  fullText: { color: '#1a1a1a' },
  outOfStockText: { color: '#1a1a1a', fontWeight: '600' },
  
  tagsContainer: {
    marginTop: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  tagText: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '600',
  },
  
  actionContainer: {
    padding: 20,
    paddingTop: 0,
  },
  registerBtn: {
    backgroundColor: '#1a1a1a',
    padding: 18,
    borderRadius: 0,
    alignItems: 'center',
  },
  disabledBtn: {
    backgroundColor: '#d0d0d0',
  },
  registerBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  blockingMessage: {
    backgroundColor: '#f5f5f5',
    padding: 18,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  successMessage: {
    backgroundColor: '#f5f5f5',
  },
  blockingText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.3
  },
  successText: {
    marginBottom: 10,
  },
  viewTicketBtn: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 0,
    marginTop: 5,
  },
  viewTicketBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
    elevation: 5,
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 20,
    width: Platform.OS === 'web' ? 500 : '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1a1a1a',
    letterSpacing: 0.3
  },
  formSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    marginTop: 8,
  },
  sectionNote: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 0,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#ffffff'
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: '#ffffff'
  },
  optionBtnSelected: {
    borderColor: '#1a1a1a',
    backgroundColor: '#1a1a1a',
  },
  optionText: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#ffffff',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalActions: {
    gap: 10,
    marginTop: 10,
  },
  submitBtn: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 0,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  cancelBtn: {
    padding: 15,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#666666',
    fontSize: 14,
  },

  // Organizer View Styles
  organizerLabel: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  publishedBadge: { backgroundColor: '#f5f5f5' },
  draftBadge: { backgroundColor: '#f5f5f5' },
  ongoingBadge: { backgroundColor: '#f5f5f5' },
  closedBadge: { backgroundColor: '#f5f5f5' },
  statusBadge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  statusText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.3
  },
  analyticsContainer: {
    gap: 15,
  },
  analyticsRow: {
    flexDirection: 'row',
    gap: 15,
  },
  analyticsBox: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  analyticsNumber: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  teamsSection: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 0,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  teamsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  teamsText: {
    fontSize: 12,
    color: '#666666',
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  exportBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  exportBtnText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 0,
    padding: 12,
    fontSize: 14,
    marginBottom: 15,
    backgroundColor: '#ffffff',
  },
  emptyParticipants: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  participantEmail: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  participantMeta: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  participantMetaText: {
    fontSize: 11,
    color: '#666666',
  },
  teamLeaderInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  teamLeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  teamLeaderText: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 2,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 15,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1a1a1a',
  },
  radioLabel: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  participantStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  statusRegistered: {
    backgroundColor: '#f5f5f5',
  },
  statusCancelled: {
    backgroundColor: '#f5f5f5',
  },
  statusCompleted: {
    backgroundColor: '#f5f5f5',
  },
  participantStatusText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
  },
  participantMobile: {
    fontSize: 12,
    color: '#666666',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 4,
    marginHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 0,
  },
  activeTab: {
    backgroundColor: '#1a1a1a',
  },
  tabText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // Payment Approval Cards
  approvalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  approvalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  approvalEmail: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  approvalDate: {
    fontSize: 12,
    color: '#666666',
  },
  pendingBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  pendingBadgeText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
  },
  purchaseInfo: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 0,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  purchaseLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  purchaseText: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 3,
  },
  proofContainer: {
    marginBottom: 12,
  },
  proofLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 0,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  noProofContainer: {
    width: '100%',
    height: 100,
    borderRadius: 0,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noProofText: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '600',
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 0,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#666666',
    padding: 12,
    borderRadius: 0,
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5
  },

  // Attendance Styles
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 10,
  },
  attendanceActions: {
    flexDirection: 'row',
    gap: 10,
  },
  scanBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  scanBtnText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 14,
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  statValue: {
    color: '#1a1a1a',
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 5,
  },
  statLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  attendanceLists: {
    gap: 20,
  },
  attendanceSection: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  attendanceSectionTitle: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    letterSpacing: 0.3
  },
  attendanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 0,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceName: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  attendanceEmail: {
    color: '#666666',
    fontSize: 13,
    marginBottom: 3,
  },
  attendanceTime: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  overrideBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
    marginTop: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  overrideBadgeText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
  },
  overrideBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
  },
  overrideBtnText: {
    color: '#ffffff',
    fontSize: 18,
  },
  markPresentBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
  },
  markPresentBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5
  },

  // Manual Override Modal Styles
  overrideInfo: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 0,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  overrideName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  overrideEmail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5,
  },
  overrideStatus: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600',
    marginTop: 5,
  },
  overrideLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  overrideInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 0,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  confirmOverrideBtn: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 0,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmOverrideBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5
  },
  cancelOverrideBtn: {
    backgroundColor: '#666666',
    padding: 16,
    borderRadius: 0,
    alignItems: 'center',
  },
  cancelOverrideBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5
  },

  // Discussion Forum Styles
  forumSection: {
    margin: 20,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  forumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0'
  },
  forumHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forumTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: 0.3
  },
  markReadButton: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
  },
  markReadButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  messageBadge: {
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  messageBadgeText: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '600',
  },
  forumToggle: {
    fontSize: 20,
    color: '#1a1a1a',
  },
  forumContent: {
    padding: 15,
  },
  
  // Message Input
  messageInputContainer: {
    marginBottom: 20,
  },
  replyingToBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 0,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  replyingToText: {
    color: '#1a1a1a',
    fontSize: 13,
  },
  cancelReplyText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  announcementToggle: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 0,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  announcementToggleText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#1a1a1a',
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  sendButton: {
    backgroundColor: '#1a1a1a',
    width: 44,
    height: 44,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#d0d0d0',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  typingIndicator: {
    color: '#666666',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 5,
  },

  // Messages List
  messagesList: {
    gap: 15,
  },
  emptyMessages: {
    padding: 40,
    alignItems: 'center',
  },
  emptyMessagesText: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
  messageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 15,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  pinnedMessage: {
    borderColor: '#1a1a1a',
    borderWidth: 2,
    backgroundColor: '#f5f5f5',
  },
  announcementMessage: {
    borderColor: '#1a1a1a',
    borderWidth: 2,
    backgroundColor: '#f5f5f5',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageAuthorName: {
    color: '#1a1a1a',
    fontSize: 15,
    fontWeight: '600',
  },
  roleTag: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  organizerTag: {
    backgroundColor: '#f5f5f5',
  },
  adminTag: {
    backgroundColor: '#f5f5f5',
  },
  roleTagText: {
    color: '#1a1a1a',
    fontSize: 10,
    fontWeight: '600',
  },
  messageTime: {
    color: '#666666',
    fontSize: 11,
  },
  messageBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  pinnedBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  pinnedBadgeText: {
    color: '#1a1a1a',
    fontSize: 10,
    fontWeight: '600',
  },
  announcementBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  announcementBadgeText: {
    color: '#1a1a1a',
    fontSize: 10,
    fontWeight: '600',
  },
  messageContent: {
    color: '#1a1a1a',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  reactionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
  },
  messageActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
  },
  messageAction: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  messageActionText: {
    color: '#666666',
    fontSize: 12,
  },
  deleteAction: {
    color: '#1a1a1a',
  },
  
  // Threaded Replies
  repliesContainer: {
    marginLeft: 20,
    marginTop: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#d0d0d0',
    paddingLeft: 15,
  },
  replyCard: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  replyIndicator: {
    width: 2,
    backgroundColor: '#d0d0d0',
    marginRight: 10,
  },
  replyContent: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 0,
  },
  replyAuthorName: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '600',
  },
  replyTime: {
    color: '#666666',
    fontSize: 10,
  },
  replyContentText: {
    color: '#1a1a1a',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 8,
  },
  
  // Tab notification badge
  tabWithBadge: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#1a1a1a',
    borderRadius: 0,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Feedback styles
  feedbackSection: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  feedbackToggle: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  feedbackToggleText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleIcon: {
    color: '#1a1a1a',
    fontSize: 14,
  },
  feedbackForm: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 0,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  feedbackFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 5,
    letterSpacing: 0.3
  },
  feedbackFormSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  starButton: {
    padding: 5,
  },
  starLarge: {
    fontSize: 40,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 0,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
    minHeight: 100,
    marginBottom: 15,
    textAlignVertical: 'top'
  },
  submitFeedbackBtn: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 0,
    alignItems: 'center',
  },
  submitFeedbackBtnDisabled: {
    backgroundColor: '#d0d0d0',
  },
  submitFeedbackBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  submittedFeedback: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    borderLeftWidth: 2,
    borderLeftColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  submittedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  star: {
    fontSize: 20,
  },
  submittedComment: {
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 10,
    lineHeight: 20,
  },
  submittedDate: {
    fontSize: 12,
    color: '#666666',
  },
  
  // Organizer feedback tab styles
  statsCard: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 0,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 5,
  },
  ratingDistribution: {
    gap: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  starLabel: {
    width: 50,
    fontSize: 14,
    color: '#1a1a1a',
  },
  ratingBar: {
    flex: 1,
    height: 20,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  ratingCount: {
    width: 30,
    textAlign: 'right',
    fontSize: 14,
    color: '#666666',
  },
  filterContainer: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  filterBtnActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  filterBtnText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#ffffff',
  },
  feedbackList: {
    maxHeight: 500,
  },
  feedbackCard: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 0,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedbackDate: {
    fontSize: 12,
    color: '#666666',
  },
  feedbackComment: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  
  // Additional Feedback Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 0,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  ratingNumber: {
    color: '#1a1a1a',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
    letterSpacing: 0.3
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    width: 50,
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  barFill: {
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  ratingCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    width: 30,
    textAlign: 'right',
  },
  filterScroll: {
    marginTop: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: '#ffffff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  filterButtonActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  emptyFeedback: {
    padding: 30,
    alignItems: 'center',
  },
  emptyFeedbackText: {
    fontSize: 14,
    color: '#666666',
  },
  feedbackRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  starsDisplay: {
    flexDirection: 'row',
  },
  starIcon: {
    fontSize: 16,
    marginRight: 2,
  },
  
  // Participant Feedback Form Styles
  feedbackSection: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  feedbackToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  feedbackToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  toggleIcon: {
    fontSize: 18,
    color: '#1a1a1a',
  },
  feedbackForm: {
    marginTop: 15,
    padding: 10,
  },
  feedbackFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 5,
    letterSpacing: 0.3
  },
  feedbackFormSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  ratingSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 15,
  },
  starButton: {
    padding: 5,
  },
  starLarge: {
    fontSize: 40,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 15,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 0,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  submitFeedbackBtn: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 0,
    alignItems: 'center',
  },
  submitFeedbackBtnDisabled: {
    backgroundColor: '#d0d0d0',
  },
  submitFeedbackBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  submittedFeedback: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  submittedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  star: {
    fontSize: 24,
    marginRight: 5,
  },
  submittedComment: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
    marginBottom: 10,
  },
  submittedDate: {
    fontSize: 12,
    color: '#666666',
    fontStyle: 'italic',
  },
});

export default EventDetailScreen;
