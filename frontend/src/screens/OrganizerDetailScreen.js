import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import Navbar from '../../components/Navbar';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OrganizerDetailScreen = ({ route, navigation }) => {
  const { organizerId } = route.params;
  const [organizer, setOrganizer] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming, past
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizerDetails();
    fetchOrganizerEvents();
  }, []);

  const fetchOrganizerDetails = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/organizers/${organizerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrganizer(response.data);
      console.log('Organizer fetched:', response.data);
    } catch (error) {
      console.error('Error fetching organizer:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const fetchOrganizerEvents = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get('/events', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allEvents = response.data;
      
      // Filter events by this organizer
      const organizerEvents = allEvents.filter(event => {
        const orgId = event.organizerid?._id || event.organizerid;
        return orgId?.toString() === organizerId?.toString();
      });
      setEvents(organizerEvents);
      console.log('Organizer events:', organizerEvents.length);
    } catch (error) {
      console.error('Error fetching events:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.startdate);
    const now = new Date();
    
    if (activeTab === 'upcoming') {
      return eventDate >= now;
    } else {
      return eventDate < now;
    }
  });

  const renderEvent = ({ item }) => (
    <TouchableOpacity 
      style={styles.eventCard}
      onPress={() => navigation.navigate('EventDetail', { eventId: item._id })}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventIcon}>{item.type === 'Merchandise' ? '🛍️' : '🎪'}</Text>
        <View style={styles.eventInfo}>
          <Text style={styles.eventName}>{item.name}</Text>
          <Text style={styles.eventType}>{item.type}</Text>
        </View>
      </View>
      
      <Text style={styles.eventDescription} numberOfLines={2}>
        {item.description}
      </Text>
      
      <View style={styles.eventFooter}>
        <Text style={styles.eventDate}>
          📅 {new Date(item.startdate).toLocaleDateString()}
        </Text>
        {item.registrationFee > 0 && (
          <Text style={styles.eventFee}>💰 ₹{item.registrationFee}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading || !organizer) {
    return (
      <View style={styles.container}>
        <Navbar navigation={navigation} activeScreen="Clubs" />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#8338ec" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Navbar navigation={navigation} activeScreen="Clubs" />
      
      <ScrollView>
        {/* Organizer Info */}
        <View style={styles.orgHeader}>
          <View style={styles.orgIcon}>
          </View>
          <Text style={styles.orgName}>{organizer.name}</Text>
          <Text style={styles.orgCategory}>{organizer.category}</Text>
          <Text style={styles.orgDescription}>{organizer.description}</Text>
          
          <View style={styles.contactInfo}>
            <Text style={styles.contactText}>📧 {organizer.contactemail}</Text>
            {organizer.contactnumber && (
              <Text style={styles.contactText}>📞 {organizer.contactnumber}</Text>
            )}
          </View>
        </View>

        {/* Events Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'past' && styles.activeTab]}
            onPress={() => setActiveTab('past')}
          >
            <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
              Past
            </Text>
          </TouchableOpacity>
        </View>

        {/* Events List */}
        <View style={styles.eventsContainer}>
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {activeTab} events</Text>
            </View>
          ) : (
            <FlatList
              data={filteredEvents}
              keyExtractor={(item) => item._id}
              renderItem={renderEvent}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgHeader: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  orgIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(131, 56, 236, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  orgEmoji: {
    fontSize: 50,
  },
  orgName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  orgCategory: {
    fontSize: 16,
    color: '#ff9800',
    fontWeight: '600',
    marginBottom: 15,
  },
  orgDescription: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  contactInfo: {
    alignItems: 'center',
  },
  contactText: {
    fontSize: 14,
    color: '#aaa',
    marginVertical: 3,
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#8338ec',
  },
  tabText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  eventsContainer: {
    padding: 20,
  },
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventIcon: {
    fontSize: 30,
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  eventType: {
    fontSize: 12,
    color: '#8338ec',
    fontWeight: '600',
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventDate: {
    fontSize: 12,
    color: '#999',
  },
  eventFee: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#ccc',
  },
});

export default OrganizerDetailScreen;
