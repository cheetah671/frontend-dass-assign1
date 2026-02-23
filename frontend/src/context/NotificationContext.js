import React, { createContext, useState, useContext } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [eventNotifications, setEventNotifications] = useState({});
  const [notificationDetails, setNotificationDetails] = useState({}); // Store message details

  const incrementNotification = (eventId) => {
    setEventNotifications(prev => ({
      ...prev,
      [eventId]: (prev[eventId] || 0) + 1
    }));
  };

  const clearNotification = (eventId) => {
    setEventNotifications(prev => ({
      ...prev,
      [eventId]: 0
    }));
    setNotificationDetails(prev => ({
      ...prev,
      [eventId]: []
    }));
  };

  const setNotification = (eventId, count, messages = []) => {
    setEventNotifications(prev => ({
      ...prev,
      [eventId]: count
    }));
    setNotificationDetails(prev => ({
      ...prev,
      [eventId]: messages
    }));
  };

  const getTotalNotifications = () => {
    return Object.values(eventNotifications).reduce((sum, count) => sum + count, 0);
  };

  const getEventNotification = (eventId) => {
    return eventNotifications[eventId] || 0;
  };

  const getNotificationDetails = (eventId) => {
    return notificationDetails[eventId] || [];
  };

  return (
    <NotificationContext.Provider
      value={{
        eventNotifications,
        notificationDetails,
        incrementNotification,
        clearNotification,
        setNotification,
        getTotalNotifications,
        getEventNotification,
        getNotificationDetails,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
