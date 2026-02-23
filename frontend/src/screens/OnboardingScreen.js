import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OnboardingScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [followedClubs, setFollowedClubs] = useState([]);

  const interests = [
    { id: 'technical', label: 'Technical' },
    { id: 'cultural', label: 'Cultural' },
    { id: 'sports', label: 'Sports' },
    { id: 'music', label: 'Music' },
    { id: 'dance', label: 'Dance' },
    { id: 'art', label: 'Art' },
    { id: 'literature', label: 'Literature' },
    { id: 'entrepreneurship', label: 'Entrepreneurship' },
  ];

  useEffect(() => {
    if (step === 2) {
      fetchOrganizers();
    }
  }, [step]);

  const fetchOrganizers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get('/organizers/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrganizers(response.data);
    } catch (error) {
      console.error('Error fetching organizers:', error);
    }
  };

  const toggleInterest = (interestId) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const toggleClub = (clubId) => {
    setFollowedClubs(prev =>
      prev.includes(clubId)
        ? prev.filter(id => id !== clubId)
        : [...prev, clubId]
    );
  };

  const handleSkip = () => {
    navigation.replace('Home');
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      console.log('Saving preferences:', {
        interests: selectedInterests,
        followedclubs: followedClubs
      });
      console.log('Token:', token ? 'exists' : 'missing');
      console.log('API URL:', api.defaults.baseURL);
      
      const response = await api.put('/auth/preferences', {
        interests: selectedInterests,
        followedclubs: followedClubs
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Preferences saved successfully:', response.data);

      if (Platform.OS === 'web') {
        alert('Preferences saved!');
        navigation.replace('Home');
      } else {
        Alert.alert('Success', 'Preferences saved!', [
          { text: 'OK', onPress: () => navigation.replace('Home') }
        ]);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error config:', error.config);
      
      const errorMsg = error.response?.data?.message || error.message || 'Failed to save preferences';
      
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {step === 1 ? 'What interests you?' : 'Follow Clubs'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {step === 1 
            ? 'Select your areas of interest' 
            : 'Stay updated with your favorite organizers'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 ? (
          <View style={styles.grid}>
            {interests.map((interest) => (
              <TouchableOpacity
                key={interest.id}
                style={[
                  styles.interestCard,
                  selectedInterests.includes(interest.id) && styles.selectedCard
                ]}
                onPress={() => toggleInterest(interest.id)}
              >
                <Text style={[
                  styles.interestLabel,
                  selectedInterests.includes(interest.id) && styles.selectedLabel
                ]}>
                  {interest.label}
                </Text>
                {selectedInterests.includes(interest.id) && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.clubsList}>
            {organizers.map((organizer) => (
              <TouchableOpacity
                key={organizer._id}
                style={[
                  styles.clubCard,
                  followedClubs.includes(organizer._id) && styles.selectedClubCard
                ]}
                onPress={() => toggleClub(organizer._id)}
              >
                <View style={styles.clubInfo}>
                  <Text style={styles.clubName}>{organizer.name}</Text>
                  <Text style={styles.clubCategory}>{organizer.category}</Text>
                  {organizer.description && (
                    <Text style={styles.clubDescription} numberOfLines={2}>
                      {organizer.description}
                    </Text>
                  )}
                </View>
                <View style={[
                  styles.followButton,
                  followedClubs.includes(organizer._id) && styles.followingButton
                ]}>
                  <Text style={[
                    styles.followText,
                    followedClubs.includes(organizer._id) && styles.followingText
                  ]}>
                    {followedClubs.includes(organizer._id) ? 'Following' : 'Follow'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
          <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextText}>
              {step === 1 ? 'Next' : 'Finish'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { 
    alignItems: 'center', 
    paddingTop: 60, 
    paddingHorizontal: 24, 
    paddingBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  headerEmoji: { display: 'none' },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '600', 
    color: '#1a1a1a', 
    marginBottom: 8,
    letterSpacing: 0.5
  },
  headerSubtitle: { 
    fontSize: 14, 
    color: '#666666', 
    textAlign: 'center',
    fontWeight: '400'
  },
  content: { padding: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  interestCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    position: 'relative',
  },
  selectedCard: {
    borderColor: '#1a1a1a',
    borderWidth: 2,
    backgroundColor: '#ffffff',
  },
  interestEmoji: { display: 'none' },
  interestLabel: { 
    fontSize: 14, 
    fontWeight: '500', 
    color: '#666666', 
    textAlign: 'center',
    letterSpacing: 0.3
  },
  selectedLabel: { 
    color: '#1a1a1a', 
    fontWeight: '600' 
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#1a1a1a',
    width: 20,
    height: 20,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  clubsList: { gap: 12 },
  clubCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  selectedClubCard: {
    borderColor: '#1a1a1a',
    borderWidth: 2,
    backgroundColor: '#ffffff',
  },
  clubInfo: { flex: 1, marginRight: 16 },
  clubName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#1a1a1a', 
    marginBottom: 4,
    letterSpacing: 0.3
  },
  clubCategory: { 
    fontSize: 13, 
    color: '#666666', 
    marginBottom: 6,
    fontWeight: '500'
  },
  clubDescription: { 
    fontSize: 13, 
    color: '#888888', 
    lineHeight: 18 
  },
  followButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 0,
  },
  followingButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  followText: { 
    color: '#ffffff', 
    fontWeight: '600', 
    fontSize: 13,
    letterSpacing: 0.5
  },
  followingText: { 
    color: '#1a1a1a' 
  },
  footer: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 0,
    backgroundColor: '#d0d0d0',
  },
  progressDotActive: {
    backgroundColor: '#1a1a1a',
    width: 24,
  },
  buttonContainer: { flexDirection: 'row', gap: 12 },
  skipButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  skipText: { 
    color: '#666666', 
    fontSize: 14, 
    fontWeight: '600',
    letterSpacing: 0.5
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 0,
    alignItems: 'center',
  },
  nextText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600',
    letterSpacing: 0.5
  },
});

export default OnboardingScreen;
