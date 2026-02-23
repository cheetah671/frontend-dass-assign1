import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../src/context/NotificationContext';

const Navbar = ({ navigation, activeScreen }) => {
  const [userRole, setUserRole] = useState('participant');
  const { eventNotifications, notificationDetails } = useNotifications();
  
  // Recalculate total notifications whenever eventNotifications changes
  const totalNotifications = Object.values(eventNotifications).reduce((sum, count) => sum + count, 0);

  // Build tooltip text from notification details
  const getNotificationTooltip = () => {
    const lines = [];
    Object.keys(eventNotifications).forEach(eventId => {
      const count = eventNotifications[eventId];
      if (count > 0) {
        const messages = notificationDetails[eventId] || [];
        if (messages.length > 0) {
          messages.forEach(msg => {
            lines.push(`${msg.authorName} (${msg.authorRole}): ${msg.content.substring(0, 50)}...`);
          });
        } else {
          lines.push(`${count} unread message${count > 1 ? 's' : ''}`);
        }
      }
    });
    return lines.join('\n') || `${totalNotifications} unread message${totalNotifications > 1 ? 's' : ''}`;
  };

  useEffect(() => {
    getUserRole();
  }, []);

  const getUserRole = async () => {
    const role = await AsyncStorage.getItem('userRole');
    if (role) setUserRole(role);
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    if (Platform.OS === 'web') {
      window.location.reload();
    } else {
      navigation.replace('Login');
    }
  };

  // Define navigation items based on user role
  const getNavItems = () => {
    if (userRole === 'admin') {
      return [
        { name: 'Dashboard', screen: 'Home' },
        { name: 'Manage Organizers', screen: 'Admin' },
        { name: 'Password Requests', screen: 'AdminPasswordRequests' },
        { name: 'Events', screen: 'Events' },
        { name: 'Profile', screen: 'Profile' },
      ];
    } else if (userRole === 'organizer') {
      return [
        { name: 'Dashboard', screen: 'Home' },
        { name: 'Create Event', screen: 'CreateEvent' },
        { name: 'Ongoing Events', screen: 'Events' },
        { name: 'Profile', screen: 'Profile' },
      ];
    } else {
      return [
        { name: 'Dashboard', screen: 'Home' },
        { name: 'Browse Events', screen: 'Events' },
        { name: 'Clubs', screen: 'Clubs' },
        { name: 'Profile', screen: 'Profile' },
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <View style={styles.navbar}>
      <View style={styles.navLeft}>
        <Text style={styles.logo}>FELICITY</Text>
      </View>
      
      <View style={styles.navCenter}>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={[styles.navItem, activeScreen === item.screen && styles.navItemActive]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={[styles.navText, activeScreen === item.screen && styles.navTextActive]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.navRight}>
        {totalNotifications > 0 && (
          <TouchableOpacity 
            style={styles.notificationBtn}
            onPress={() => navigation.navigate('Events')}
            title={Platform.OS === 'web' ? getNotificationTooltip() : undefined}
            accessibilityLabel={getNotificationTooltip()}
          >
            <Text 
              style={styles.notificationText}
              {...(Platform.OS === 'web' && { title: getNotificationTooltip() })}
            >
              💬 {totalNotifications} New
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  navLeft: {
    flex: 1,
  },
  logo: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: 2,
  },
  navCenter: {
    flex: 3,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  navText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
  navTextActive: {
    color: '#1a1a1a',
    fontWeight: '600',
  },
  navRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  notificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  notificationText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  logoutText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Navbar;
