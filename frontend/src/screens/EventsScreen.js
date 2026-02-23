import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Platform, Alert, Modal, ScrollView, TextInput, Dimensions } from 'react-native';
import Navbar from '../../components/Navbar';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../context/NotificationContext';

const { width } = Dimensions.get('window');

const EventsScreen = ({ navigation }) => {
  const { getEventNotification } = useNotifications();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [trendingEvents, setTrendingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followedClubs, setFollowedClubs] = useState([]);
  
  // --- Search & Filter State ---
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("All"); // All, Normal, Merchandise, Followed
  const [filterEligibility, setFilterEligibility] = useState("All"); // All, Open to all, IIIT Only
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);

  // --- Modal State ---
  const [modalVisible, setModalVisible] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [selectedEventName, setSelectedEventName] = useState("");

  useEffect(() => {
    fetchEvents();
    fetchFollowedClubs();
  }, []);

  // ✅ NEW: Re-run filter whenever any filter changes
  useEffect(() => {
    filterData();
  }, [searchText, filterType, filterEligibility, dateRange, events, followedClubs]);

  const fetchEvents = async () => {
    try {
      const response = await api.get('/events');
      const allEvents = response.data;
      setEvents(allEvents);
      
      // Fetch trending events from backend (calculates registrations in last 24h)
      try {
        const trendingResponse = await api.get('/events/trending');
        setTrendingEvents(trendingResponse.data);
      } catch (trendingError) {
        console.error('Error fetching trending events:', trendingError);
        setTrendingEvents([]); // Fallback to empty array
      }
    } catch (error) {
      console.error(error);
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
      setFollowedClubs([]); // Fallback to empty array
    }
  };

  // ✅ ENHANCED: Memoized fuzzy matching filter logic
  const fuzzyMatch = useCallback((text, query) => {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact match (faster)
    if (textLower.includes(queryLower)) return true;
    
    // Fuzzy matching - check if query characters appear in order
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === queryLower.length;
  }, []);

  const filterData = useCallback(() => {
    let result = events;

    // 1. Filter by Type
    if (filterType === 'Normal' || filterType === 'Merchandise') {
      result = result.filter(item => item.type === filterType);
    } else if (filterType === 'Followed') {
      result = result.filter(item => followedClubs.includes(item.organizerid?._id));
    }

    // 2. Filter by Eligibility
    if (filterEligibility !== 'All') {
      result = result.filter(item => item.eligibility === filterEligibility);
    }

    // 3. Filter by Date Range
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      result = result.filter(item => new Date(item.startdate) >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      result = result.filter(item => new Date(item.startdate) <= endDate);
    }

    // 4. Filter by Search Text (Fuzzy matching on event/organizer names)
    if (searchText) {
      result = result.filter(item => 
        fuzzyMatch(item.name, searchText) || 
        fuzzyMatch(item.description, searchText) ||
        fuzzyMatch(item.organizerid?.name || '', searchText)
      );
    }

    // 5. SMART SORTING: Prioritize followed clubs (Preference-based recommendations)
    result = result.sort((a, b) => {
      const aIsFollowed = followedClubs.includes(a.organizerid?._id);
      const bIsFollowed = followedClubs.includes(b.organizerid?._id);
      
      // Followed clubs come first
      if (aIsFollowed && !bIsFollowed) return -1;
      if (!aIsFollowed && bIsFollowed) return 1;
      
      // Then sort by date (upcoming first)
      return new Date(a.startdate) - new Date(b.startdate);
    });

    setFilteredEvents(result);
  }, [events, filterType, filterEligibility, dateRange, searchText, followedClubs, fuzzyMatch]);

  const handleRegister = useCallback((event) => {
    navigation.navigate('EventDetail', { eventId: event._id });
  }, [navigation]);

  const handleViewParticipants = useCallback(async (event) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/events/${event._id}/participants`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.length === 0) {
        alert("No participants yet.");
        return;
      }

      setParticipants(response.data);
      setSelectedEventName(event.name);
      setModalVisible(true);

    } catch (error) {
      alert("Access Denied: Only the Organizer can view this.");
    }
  }, []);

  const handleDelete = useCallback(async (eventId) => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm("Are you sure you want to delete this?");
      if (!confirm) return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      await api.delete(`/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Remove from BOTH lists
      setEvents(prev => prev.filter(e => e._id !== eventId));
    } catch (error) {
      alert("Not authorized to delete");
    }
  }, []);

  return (
    <View style={styles.container}>
      <Navbar navigation={navigation} activeScreen="Events" />
      
      <View style={styles.contentWrapper}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Browse Events</Text>
          <Text style={styles.subheader}>Discover Amazing Experiences</Text>
        </View>

        {/* ✅ ENHANCED: SEARCH BAR with Fuzzy Matching */}
        <View style={styles.searchContainer}>
          <TextInput 
            style={styles.searchBar} 
            placeholder="Search events or organizers..." 
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* ✅ ENHANCED: FILTER TABS with Followed */}
        <View style={styles.filterContainer}>
          {['All', 'Normal', 'Merchandise', 'Followed'].map(type => (
            <TouchableOpacity 
              key={type} 
              style={[styles.filterTab, filterType === type && styles.activeFilterTab]}
              onPress={() => setFilterType(type)}
            >
              <Text style={[styles.filterText, filterType === type && styles.activeFilterText]}>
                {type === 'All' ? 'All' : type === 'Normal' ? 'Events' : type === 'Merchandise' ? 'Merch' : 'Followed'}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={styles.filterIconText}>Filters</Text>
          </TouchableOpacity>
        </View>

        {/* ✅ NEW: ADVANCED FILTERS PANEL */}
        {showFilters && (
          <View style={styles.advancedFilters}>
            <Text style={styles.filterLabel}>Eligibility:</Text>
            <View style={styles.miniFilterRow}>
              {['All', 'Everyone', 'BITS Only', 'Outstation Only'].map(elig => (
                <TouchableOpacity
                  key={elig}
                  style={[styles.miniFilterBtn, filterEligibility === elig && styles.activeMiniFilter]}
                  onPress={() => setFilterEligibility(elig)}
                >
                  <Text style={[styles.miniFilterText, filterEligibility === elig && styles.activeMiniText]}>
                    {elig}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Date Range:</Text>
            <View style={styles.dateRangeRow}>
              <TextInput
                style={styles.dateInput}
                placeholder="Start (YYYY-MM-DD)"
                placeholderTextColor="#999"
                value={dateRange.start}
                onChangeText={(text) => setDateRange({...dateRange, start: text})}
              />
              <Text style={styles.dateSeparator}>→</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="End (YYYY-MM-DD)"
                placeholderTextColor="#999"
                value={dateRange.end}
                onChangeText={(text) => setDateRange({...dateRange, end: text})}
              />
            </View>

            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={() => {
                setFilterEligibility('All');
                setDateRange({ start: '', end: '' });
                setShowFilters(false);
              }}
            >
              <Text style={styles.clearFiltersText}>✖ Clear Advanced Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ✅ NEW: TRENDING EVENTS SECTION (Top 5 in 24h) */}
        {trendingEvents.length > 0 && (
          <View style={styles.trendingSection}>
            <Text style={styles.trendingSectionHeader}>Trending (24h)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendingScroll}>
              {trendingEvents.map(event => (
                <TouchableOpacity
                  key={event._id}
                  style={styles.trendingCard}
                  onPress={() => navigation.navigate('EventDetail', { eventId: event._id })}
                >
                  <Text style={styles.trendingTitle} numberOfLines={2}>{event.name}</Text>
                  <Text style={styles.trendingViews}>{(event.participants || []).length} registered</Text>
                  <Text style={styles.trendingOrganizer}>by {event.organizerid?.name || 'Unknown'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#ff006e" />
          <Text style={styles.loadingText}>Loading Events...</Text>
        </View>
      ) : (
        <FlatList 
          data={filteredEvents} // Use the Filtered List!
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No events found matching filters</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMerch = item.type === 'Merchandise';
            const isOutOfStock = isMerch && item.stock <= 0;
            const startDate = item.startdate ? new Date(item.startdate) : null;
            const endDate = item.enddate ? new Date(item.enddate) : null;
            const regDeadline = item.registrationdeadline ? new Date(item.registrationdeadline) : null;
            const organizerName = item.organizerid?.name || 'Unknown Organizer';
            const organizerClub = item.organizerid?.category || 'N/A';
            const organizerPhone = item.organizerid?.contactnumber || 'Not provided';
            const registrationCount = (item.participants || []).length;
            const registrationLimit = item.registrationLimit || 0;
            const isFull = registrationLimit > 0 && registrationCount >= registrationLimit;

            return (
              <TouchableOpacity 
                style={[styles.card, isMerch && styles.merchCard]}
                onPress={() => navigation.navigate('EventDetail', { eventId: item._id })}
                activeOpacity={0.8}
              >
                
                {/* Event Image/Placeholder */}
                {isMerch && item.image && (
                  <Image source={{ uri: item.image }} style={styles.eventImage} resizeMode="cover"/>
                )}

                {/* Event Content */}
                <View style={styles.textContainer}>
                  {/* Title and Badge Row */}
                  <View style={styles.titleRow}>
                    <Text style={styles.eventName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.badgeContainer}>
                      {isMerch && <View style={styles.merchBadge}><Text style={styles.merchBadgeText}>MERCH</Text></View>}
                      {getEventNotification(item._id) > 0 && (
                        <View style={styles.messageBadge}>
                          <Text style={styles.messageBadgeText}>💬 {getEventNotification(item._id)}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Organizer Info */}
                  <View style={styles.organizerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.organizerName} numberOfLines={1}>{organizerName}</Text>
                      <Text style={styles.organizerClub} numberOfLines={1}>{organizerClub}</Text>
                      <Text style={styles.organizerPhone} numberOfLines={1}>{organizerPhone}</Text>
                    </View>
                  </View>

                  {/* Date Info */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <View>
                        <Text style={styles.infoLabel}>Start</Text>
                        <Text style={styles.infoValue}>
                          {startDate ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoItem}>
                      <View>
                        <Text style={styles.infoLabel}>End</Text>
                        <Text style={styles.infoValue}>
                          {endDate ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoItem}>
                      <View>
                        <Text style={styles.infoLabel}>Deadline</Text>
                        <Text style={styles.infoValue}>
                          {regDeadline ? regDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Description */}
                  <Text style={styles.eventDescription} numberOfLines={2}>{item.description}</Text>

                  {/* Metadata Row */}
                  <View style={styles.metaRow}>
                    {/* Registration Info for Normal Events */}
                    {!isMerch && (
                      <View style={styles.regInfo}>
                        <Text style={styles.regCount}>{registrationCount}{registrationLimit > 0 ? `/${registrationLimit}` : ''} </Text>
                        {isFull && <Text style={styles.fullBadge}>FULL</Text>}
                      </View>
                    )}
                    
                    {/* Fee Info */}
                    {item.registrationFee > 0 && !isMerch && (
                      <Text style={styles.feeTag}>₹{item.registrationFee}</Text>
                    )}
                    {!isMerch && item.registrationFee === 0 && (
                      <Text style={styles.freeTag}>FREE</Text>
                    )}

                    {/* Merch Price and Stock */}
                    {isMerch && (
                      <>
                        <View style={styles.priceContainer}>
                          <Text style={styles.priceTag}>₹{item.price}</Text>
                        </View>
                        <View style={[styles.stockContainer, isOutOfStock ? styles.redStock : styles.greenStock]}>
                          <Text style={styles.stockTag}>{item.stock} in stock</Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Tags */}
                  {item.eventTags && item.eventTags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {item.eventTags.slice(0, 3).map((tag, idx) => (
                        <View key={idx} style={styles.tagChip}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.registerButton, 
                      isMerch && styles.buyButton, 
                      (isOutOfStock || isFull) && styles.disabledButton
                    ]} 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRegister(item);
                    }}
                    disabled={isOutOfStock || isFull}
                  >
                    <Text style={styles.buttonText}>
                      {isOutOfStock ? "Out of Stock" : 
                       isFull ? "Full" :
                       isMerch ? "Buy Now" : "Register"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.viewButton} 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleViewParticipants(item);
                    }}
                  >
                    <Text style={styles.iconButtonText}>View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.deleteButton} 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDelete(item._id);
                    }}
                  >
                    <Text style={styles.iconButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>

              </TouchableOpacity>
            );
          }}
        />
      )}
      </View>

      {/* MODAL (Unchanged) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Participants List</Text>
            <Text style={styles.modalSubtitle}>{selectedEventName}</Text>
            
            <ScrollView style={styles.listContainer}>
              {participants.map((user, index) => (
                <View key={index} style={styles.userRow}>
                  <View style={styles.userBadge}>
                    <Text style={styles.userIndex}>#{index + 1}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  contentWrapper: { flex: 1, paddingHorizontal: 24 },
  
  headerContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  header: { 
    fontSize: Platform.OS === 'web' ? 28 : 24, 
    fontWeight: '600', 
    textAlign: 'center',
    color: '#1a1a1a',
    letterSpacing: 0.5
  },
  subheader: {
    fontSize: 14,
    color: '#666666',
    marginTop: 6,
    fontWeight: '400'
  },
  
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    paddingHorizontal: 16,
    marginBottom: 20,
    marginTop: 20,
    width: Platform.OS === 'web' ? 600 : '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  searchIcon: { fontSize: 16, marginRight: 10, color: '#666666' },
  searchBar: { 
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a'
  },
  
  // Filter Tabs
  filterContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginBottom: 24, 
    gap: 12 
  },
  filterTab: { 
    paddingVertical: 10, 
    paddingHorizontal: 18, 
    borderRadius: 0, 
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  activeFilterTab: { 
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a'
  },
  filterText: { fontWeight: '600', color: '#666666', fontSize: 13, letterSpacing: 0.3 },
  activeFilterText: { color: '#ffffff' },
  
  // Loading & Empty States
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100
  },
  loadingText: {
    color: '#666666',
    marginTop: 15,
    fontSize: 14,
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100
  },
  emptyEmoji: { display: 'none' },
  emptyText: { 
    textAlign: 'center', 
    fontSize: 16, 
    color: '#666666',
    fontWeight: '500'
  },

  listContent: {
    paddingBottom: 30,
    alignItems: 'center'
  },

  // Event Cards
  card: { 
    backgroundColor: '#ffffff',
    padding: 24, 
    marginBottom: 16, 
    borderRadius: 0,
    width: Platform.OS === 'web' ? 600 : '100%',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  merchCard: { 
    borderLeftWidth: 3, 
    borderLeftColor: '#1a1a1a',
    backgroundColor: '#ffffff'
  },
  
  placeholderImage: {
    display: 'none'
  },
  eventPlaceholder: { display: 'none' },
  merchPlaceholder: { display: 'none' },
  placeholderEmoji: { display: 'none' },
  
  textContainer: { marginBottom: 16 },
  titleRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  eventName: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1a1a1a',
    flex: 1,
    letterSpacing: 0.3
  },
  merchBadge: { 
    backgroundColor: '#f5f5f5',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  messageBadge: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  messageBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  merchBadgeText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  dateIcon: { display: 'none' },
  eventDate: { fontSize: 13, color: '#666666', fontWeight: '500' },
  eventDescription: { fontSize: 13, color: '#888888', lineHeight: 20, marginTop: 8 },
  eventImage: { 
    display: 'none'
  },
  
  metaContainer: { 
    flexDirection: 'row', 
    marginTop: 12,
    gap: 12
  },
  priceContainer: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  priceTag: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#1a1a1a',
    letterSpacing: 0.3
  },
  stockContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 0,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  stockTag: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  greenStock: { backgroundColor: '#f5f5f5' },
  redStock: { backgroundColor: '#f5f5f5' },
  
  buttonContainer: { flexDirection: 'row', gap: 8, marginTop: 16 },
  registerButton: { 
    backgroundColor: '#1a1a1a',
    padding: 14, 
    borderRadius: 0, 
    flex: 1, 
    alignItems: 'center'
  },
  buyButton: { 
    backgroundColor: '#1a1a1a'
  },
  disabledButton: { 
    backgroundColor: '#cccccc',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  buttonText: { 
    color: '#ffffff', 
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5
  },
  deleteButton: { 
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    padding: 14, 
    borderRadius: 0,
    justifyContent: 'center',
    minWidth: 50,
    alignItems: 'center'
  },
  viewButton: { 
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    padding: 14, 
    borderRadius: 0,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center'
  },
  iconButtonText: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', letterSpacing: 0.3 },
  
  // Modal Styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    width: Platform.OS === 'web' ? 450 : '90%',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 32,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    textAlign: 'center', 
    marginBottom: 8,
    color: '#1a1a1a',
    letterSpacing: 0.3
  },
  modalSubtitle: { 
    fontSize: 14, 
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '400'
  },
  listContainer: { marginBottom: 20 },
  userRow: { 
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center'
  },
  userBadge: {
    backgroundColor: '#f5f5f5',
    width: 40,
    height: 40,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  userIndex: { 
    fontWeight: '600',
    color: '#1a1a1a',
    fontSize: 13
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  userEmail: { fontSize: 12, color: '#666666', marginTop: 4 },
  closeButton: { 
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 0,
    alignItems: 'center'
  },
  closeButtonText: { 
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5
  },

  // Advanced Filters Panel Styles
  filterIconBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  filterIconText: {
    fontSize: 16,
    color: '#1a1a1a'
  },
  advancedFilters: {
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 10,
    marginTop: 8,
    letterSpacing: 0.3
  },
  miniFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  miniFilterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  activeMiniFilter: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  miniFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    letterSpacing: 0.3
  },
  activeMiniText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 10,
    color: '#1a1a1a',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  dateSeparator: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
  clearFiltersBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  clearFiltersText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5
  },

  // Trending Section Styles
  trendingSection: {
    marginBottom: 24,
  },
  trendingSectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    letterSpacing: 0.3
  },
  trendingScroll: {
    marginBottom: 12,
  },
  trendingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 16,
    marginRight: 12,
    width: 180,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderLeftWidth: 3,
    borderLeftColor: '#1a1a1a'
  },
  trendingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    letterSpacing: 0.3
  },
  trendingViews: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    marginBottom: 4
  },
  trendingOrganizer: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '400',
  },

  // Informative Card Styles
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  organizerIcon: {
    display: 'none'
  },
  organizerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1
  },
  organizerClub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    marginTop: 3
  },
  organizerPhone: {
    fontSize: 11,
    fontWeight: '400',
    color: '#888888',
    marginTop: 2
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  infoIcon: {
    display: 'none'
  },
  infoLabel: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  infoValue: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 10
  },
  regInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  regCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a'
  },
  fullBadge: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
    letterSpacing: 0.3
  },
  feeTag: {
    backgroundColor: '#f5f5f5',
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  freeTag: {
    backgroundColor: '#f5f5f5',
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  tagChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  tagText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
    letterSpacing: 0.3
  }
});

export default EventsScreen;