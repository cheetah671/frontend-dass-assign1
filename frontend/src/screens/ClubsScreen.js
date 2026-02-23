import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Navbar from '../../components/Navbar';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ClubsScreen = ({ navigation }) => {
  const [organizers, setOrganizers] = useState([]);
  const [followedClubs, setFollowedClubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizers();
    fetchFollowedClubs();
  }, []);

  const fetchOrganizers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get('/organizers/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrganizers(response.data);
    } catch (error) {
      console.error('Error fetching organizers:', error);
      if (error.response?.status === 401) {
        console.error('Authentication required');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowedClubs = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get('/auth/preferences', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFollowedClubs(response.data.followedclubs || []);
    } catch (error) {
      console.error('Error fetching followed clubs:', error);
    }
  };

  const handleFollowToggle = async (organizerId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const isFollowing = followedClubs.includes(organizerId);
      
      const updatedFollowedClubs = isFollowing
        ? followedClubs.filter(id => id !== organizerId)
        : [...followedClubs, organizerId];
      
      await api.put('/auth/preferences', {
        followedclubs: updatedFollowedClubs
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFollowedClubs(updatedFollowedClubs);
      
      if (Platform.OS === 'web') {
        alert(isFollowing ? 'Unfollowed!' : 'Following!');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      if (Platform.OS === 'web') {
        alert('Failed to update follow status');
      } else {
        Alert.alert('Error', 'Failed to update follow status');
      }
    }
  };

  const renderOrganizer = ({ item }) => {
    const isFollowing = followedClubs.includes(item._id);
    
    return (
      <TouchableOpacity
        style={styles.clubCard}
        onPress={() => navigation.navigate('OrganizerDetail', { organizerId: item._id })}
      >
        <View style={styles.clubHeader}>
          <View style={styles.clubIcon}>
          </View>
          <View style={styles.clubInfo}>
            <Text style={styles.clubName}>{item.name}</Text>
            <Text style={styles.clubCategory}>{item.category}</Text>
          </View>
        </View>

        <Text style={styles.clubDescription} numberOfLines={2}>
          {item.description || 'No description available'}
        </Text>

        <View style={styles.clubFooter}>
          <Text style={styles.clubEmail}>📧 {item.contactemail}</Text>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={(e) => {
              e.stopPropagation();
              handleFollowToggle(item._id);
            }}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
              {isFollowing ? '✓ Following' : '+ Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#0a0015', '#1a0033', '#3d0066', '#8338ec']} style={styles.container}>
      <Navbar navigation={navigation} activeScreen="Clubs" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clubs & Organizers</Text>
        <Text style={styles.headerSubtitle}>Follow your favorite event organizers</Text>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#ff006e" />
        </View>
      ) : organizers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No organizers found</Text>
        </View>
      ) : (
        <FlatList
          data={organizers}
          keyExtractor={(item) => item._id}
          renderItem={renderOrganizer}
          contentContainerStyle={styles.listContent}
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 50,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ccc',
  },
  listContent: {
    padding: 20,
  },
  clubCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  clubIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8338ec',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  clubEmoji: {
    fontSize: 30,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  clubCategory: {
    fontSize: 14,
    color: '#8338ec',
    fontWeight: '600',
  },
  clubDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  clubFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clubEmail: {
    fontSize: 12,
    color: '#999',
    flex: 1,
  },
  followBtn: {
    backgroundColor: '#8338ec',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  followingBtn: {
    backgroundColor: '#4caf50',
  },
  followBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  followingBtnText: {
    color: '#fff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#ccc',
  },
});

export default ClubsScreen;
