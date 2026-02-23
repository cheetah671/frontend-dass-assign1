import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Dimensions, Animated, FlatList, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Navbar from '../../components/Navbar';
import api from '../api/api';

const ADMIN_EMAIL = "admin@felicity.iiit.ac.in"; 

const HomeScreen = ({ navigation }) => {
  const [userName, setUserName] = useState("Participant");
  const [userEmail, setUserEmail] = useState(""); 
  const [userRole, setUserRole] = useState("participant");
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAuth();
  }, []);

  // Refetch data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (userRole === 'organizer' || userRole === 'admin') {
        fetchOrganizerData();
      }
    }, [userRole])
  );

  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      // No token, redirect to login
      navigation.replace('Login');
      return;
    }
    getUserDetails();
  };

  const getUserDetails = async () => {
    const name = await AsyncStorage.getItem('userName');
    const email = await AsyncStorage.getItem('userEmail'); 
    const role = await AsyncStorage.getItem('userRole');
    
    if (name) setUserName(name.split(' ')[0]);
    if (email) setUserEmail(email);
    if (role) setUserRole(role);

    // Fetch organizer data if user is an organizer
    if (role === 'organizer' || role === 'admin') {
      fetchOrganizerData();
    } else {
      setLoading(false);
    }
  };

  const fetchOrganizerData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get('/events/myevents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(response.data);

      // Calculate overall analytics for ALL events
      const allEvents = response.data.filter(event => event.status !== 'Cancelled');
      const completedEvents = allEvents.filter(event => 
        new Date(event.enddate) < new Date()
      );

      let totalRegistrations = 0;
      let totalRevenue = 0;

      // Count registrations and revenue from ALL events (not just completed)
      allEvents.forEach(event => {
        const participantCount = event.participants?.length || 0;
        totalRegistrations += participantCount;
        
        if (event.type === 'Normal' && event.registrationFee) {
          totalRevenue += participantCount * event.registrationFee;
        } else if (event.type === 'Merchandise' && event.price) {
          totalRevenue += participantCount * event.price;
        }
      });

      setAnalytics({
        totalEvents: response.data.length,
        completedEvents: completedEvents.length,
        totalRegistrations,
        totalRevenue
      });
    } catch (error) {
      console.error('Error fetching organizer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Clear all authentication tokens and user data
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('userName');
    await AsyncStorage.removeItem('userEmail');
    await AsyncStorage.removeItem('userRole');
    if (Platform.OS === 'web') window.location.reload();
    else navigation.replace('Login');
  };

  const renderEventCard = ({ item }) => {
    const isPast = new Date(item.enddate) < new Date();
    const statusColor = '#f5f5f5';

    // Calculate revenue for this event
    const participantCount = item.participants?.length || 0;
    let revenue = 0;
    if (item.type === 'Normal' && item.registrationFee) {
      revenue = participantCount * item.registrationFee;
    } else if (item.type === 'Merchandise' && item.price) {
      revenue = participantCount * item.price;
    }

    return (
      <TouchableOpacity 
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetail', { eventId: item._id })}
      >
        <View style={styles.eventCardHeader}>
          <View style={[styles.eventStatusBadge]}>
            <Text style={styles.eventStatusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.eventCardTitle}>{item.name}</Text>
        <Text style={styles.eventCardType}>{item.type}</Text>
        <View style={styles.eventCardFooter}>
          <Text style={styles.eventCardDate}>
            {new Date(item.startdate).toLocaleDateString()}
          </Text>
          <Text style={styles.eventCardParticipants}>
            Participants: {participantCount}
          </Text>
        </View>
        {revenue > 0 && (
          <View style={styles.eventCardRevenue}>
            <Text style={styles.eventCardRevenueText}>Revenue: ₹{revenue}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Organizer Dashboard UI
  if (userRole === 'organizer' || (userRole === 'admin' && events.length > 0)) {
    return (
      <View style={styles.container}>
        <View style={styles.navbar}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>FELICITY</Text>
            <View style={styles.logoBadge}>
              <Text style={styles.badgeText}>ORGANIZER</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.greeting}>Hello, {userName}</Text>
          <Text style={styles.organizerTitle}>Organizer Dashboard</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#ff006e" style={{ marginTop: 50 }} />
          ) : (
            <>
              {/* Analytics Cards */}
              {analytics && (
                <View style={styles.analyticsSection}>
                  <Text style={styles.sectionTitle}>Overall Analytics</Text>
                  <View style={styles.analyticsGrid}>
                    <View style={[styles.analyticsCard, styles.analyticsCard1]}>
                      <Text style={styles.analyticsValue}>{analytics.totalEvents}</Text>
                      <Text style={styles.analyticsLabel}>Total Events</Text>
                    </View>
                    <View style={[styles.analyticsCard, styles.analyticsCard2]}>
                      <Text style={styles.analyticsValue}>{analytics.completedEvents}</Text>
                      <Text style={styles.analyticsLabel}>Completed</Text>
                    </View>
                    <View style={[styles.analyticsCard, styles.analyticsCard3]}>
                      <Text style={styles.analyticsValue}>{analytics.totalRegistrations}</Text>
                      <Text style={styles.analyticsLabel}>Registrations</Text>
                    </View>
                    <View style={[styles.analyticsCard, styles.analyticsCard4]}>
                      <Text style={styles.analyticsValue}>₹{analytics.totalRevenue}</Text>
                      <Text style={styles.analyticsLabel}>Revenue</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Events Carousel */}
              <Text style={styles.sectionTitle}>Your Events</Text>
              {events.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No events created yet</Text>
                  <TouchableOpacity 
                    style={styles.createEventBtn}
                    onPress={() => navigation.navigate('CreateEvent')}
                  >
                    <Text style={styles.createEventBtnText}>➕ Create Your First Event</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={events}
                  renderItem={renderEventCard}
                  keyExtractor={(item) => item._id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.eventsCarousel}
                />
              )}

              {/* Quick Actions */}
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.grid}>
                <TouchableOpacity 
                  style={[styles.card, styles.card1]} 
                  onPress={() => navigation.navigate('CreateEvent')}
                >
                  <View style={styles.cardGlow} />
                  <Text style={styles.cardTitle}>Create Event</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.card, styles.card2]} 
                  onPress={() => navigation.navigate('Events')}
                >
                  <View style={styles.cardGlow} />
                  <Text style={styles.cardTitle}>Ongoing Events</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.card, styles.card3]} 
                  onPress={() => navigation.navigate('Profile')}
                >
                  <View style={styles.cardGlow} />
                  <Text style={styles.cardTitle}>Profile</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // Participant Dashboard UI (existing code)
  return (
    <View style={styles.container}>
      {/* Animated Background Gradient */}
      <View style={styles.backgroundGradient}>
        <View style={[styles.gradientCircle, styles.circle1]} />
        <View style={[styles.gradientCircle, styles.circle2]} />
        <View style={[styles.gradientCircle, styles.circle3]} />
      </View>
      
      <View style={styles.navbar}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>FELICITY</Text>
          <View style={styles.logoBadge}>
            <Text style={styles.badgeText}>2026</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text style={styles.greeting}>Hello, {userName}</Text>
            <Text style={styles.heroTitle}>Ready for the Hype?</Text>
            <Text style={styles.heroSubtitle}>Register for the biggest cultural fest of the year.</Text>
            
            <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.navigate('Events')}>
              <Text style={styles.heroBtnText}>Explore Events</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Events')}>
            <Text style={styles.cardTitle}>Browse Events</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.cardTitle}>My Profile</Text>
          </TouchableOpacity>

          {(userRole === 'organizer' || userEmail === ADMIN_EMAIL) && (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CreateEvent')}>
              <Text style={styles.cardTitle}>Profile</Text>
              <Text style={styles.cardTitle}>Organizer</Text>
            </TouchableOpacity>
          )}

          {userEmail === ADMIN_EMAIL && (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Admin')}>
              <Text style={styles.cardTitle}>Admin Panel</Text>
              <Text style={styles.cardDesc}>Restricted Access</Text>
            </TouchableOpacity>
          )}

        </View>
        
        <View style={{ height: 50 }} /> 
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  
  navbar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    paddingTop: Platform.OS === 'web' ? 20 : 50,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  logo: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1a1a1a', 
    letterSpacing: 2
  },
  logoBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  badgeText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  logoutBtn: { 
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 0
  },
  logoutText: { 
    color: '#ffffff', 
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5
  },

  scrollContent: { padding: 24 },

  hero: { 
    width: '100%', 
    backgroundColor: '#ffffff',
    borderRadius: 0, 
    padding: 32,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  heroContent: { 
    width: '100%'
  },
  greeting: { 
    color: '#666666', 
    fontWeight: '500', 
    fontSize: 14, 
    marginBottom: 8,
    letterSpacing: 0.3
  },
  heroTitle: { 
    color: '#1a1a1a', 
    fontSize: 28, 
    fontWeight: '600', 
    marginBottom: 8,
    letterSpacing: 0.5
  },
  heroSubtitle: { 
    color: '#666666', 
    fontSize: 14, 
    marginBottom: 24,
    lineHeight: 22,
    fontWeight: '400'
  },
  heroBtn: { 
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 0,
    alignSelf: 'flex-start'
  },
  heroBtnText: { 
    fontWeight: '600', 
    color: '#ffffff',
    fontSize: 14,
    letterSpacing: 0.5
  },

  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 20, 
    color: '#1a1a1a',
    letterSpacing: 0.5
  },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    gap: 12,
    marginBottom: 40
  },
  
  card: { 
    width: Platform.OS === 'web' ? '23%' : '48%', 
    aspectRatio: 1,
    padding: 24,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    overflow: 'hidden'
  },
  cardEmoji: { 
    display: 'none',
    fontSize: 0
  },
  cardTitle: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#1a1a1a', 
    textAlign: 'center',
    letterSpacing: 0.3
  },
  cardDesc: { 
    fontSize: 12, 
    color: '#666666', 
    textAlign: 'center', 
    marginTop: 6,
    fontWeight: '400'
  },

  // Organizer Dashboard Styles
  organizerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  analyticsSection: {
    marginBottom: 40,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsCard: {
    width: Platform.OS === 'web' ? '23%' : '48%',
    padding: 24,
    borderRadius: 0,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  analyticsValue: {
    fontSize: 32,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3
  },
  eventsCarousel: {
    paddingVertical: 12,
    gap: 12,
  },
  eventCard: {
    width: 280,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventCardIcon: {
    display: 'none'
  },
  eventStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  eventStatusText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  eventCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
    letterSpacing: 0.3
  },
  eventCardType: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    marginBottom: 16,
  },
  eventCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0'
  },
  eventCardDate: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500'
  },
  eventCardParticipants: {
    fontSize: 12,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  eventCardRevenue: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  eventCardRevenueText: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  emptyEmoji: {
    display: 'none'
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    fontWeight: '500'
  },
  createEventBtn: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 0,
  },
  createEventBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5
  },
});

export default HomeScreen;