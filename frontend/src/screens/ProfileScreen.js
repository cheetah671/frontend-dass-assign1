import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Platform, Dimensions, TouchableOpacity, TextInput, Alert, Image, Modal } from 'react-native';
import Navbar from '../../components/Navbar';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('participant');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState(null);
  
  // --- State for Tabs & Editing ---
  const [activeTab, setActiveTab] = useState('Normal'); // Normal, Merchandise, Completed, Cancelled
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState("Participant");
  const [userMobile, setUserMobile] = useState("");
  
  // --- Enhanced Profile State ---
  const [userEmail, setUserEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [college, setCollege] = useState("");
  const [participantType, setParticipantType] = useState("");
  const [interests, setInterests] = useState([]);
  const [followedClubs, setFollowedClubs] = useState([]);
  const [availableInterests] = useState(['Technical', 'Cultural', 'Sports', 'Music', 'Dance', 'Drama', 'Art', 'Gaming', 'Literature']);

  // Organizer-specific fields
  const [organizerCategory, setOrganizerCategory] = useState("");
  const [organizerDescription, setOrganizerDescription] = useState("");
  const [organizerContactEmail, setOrganizerContactEmail] = useState("");
  const [discordWebhook, setDiscordWebhook] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      // 1. Get User Details from Storage (faster, no API call)
      const storedName = await AsyncStorage.getItem('userName');
      const storedRole = await AsyncStorage.getItem('userRole');
      const storedEmail = await AsyncStorage.getItem('userEmail');
      
      if (storedName) setUserName(storedName);
      if (storedRole) setUserRole(storedRole);
      if (storedEmail) setUserEmail(storedEmail);

      // 2. Parallel API calls for participants (faster)
      if (storedRole === 'participant' || storedRole === 'admin') {
        const [profileResponse, historyResponse] = await Promise.all([
          api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
            .catch(err => ({ data: null, error: err })),
          api.get('/registrations/history', { headers: { Authorization: `Bearer ${token}` } })
            .catch(err => ({ data: { registrations: [] }, error: err }))
        ]);
        
        // Set profile data
        if (profileResponse.data) {
          const userData = profileResponse.data;
          setUserEmail(userData.email);
          setUserMobile(userData.mobile || '');
          
          if (userData.participant) {
            setFirstName(userData.participant.firstName || '');
            setLastName(userData.participant.lastName || '');
            setCollege(userData.participant.college || '');
            setParticipantType(userData.participant.participanttype || '');
            setInterests(userData.participant.interests || []);
            setFollowedClubs(userData.participant.followedclubs || []);
          }
        }
        
        // Set registration history
        setRegistrations(historyResponse.data?.registrations || []);
      }

      // 3. Fetch Events for organizers (both created AND registered)
      if (storedRole === 'organizer' || storedRole === 'admin') {
        // Fetch both organized events and registered events in parallel
        const [createdEventsResponse, registrationHistoryResponse, organizerProfileResponse] = await Promise.all([
          api.get('/events/myevents', {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(err => ({ data: [] })),
          api.get('/registrations/history', {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(err => ({ data: { registrations: [] } })),
          api.get('/organizers/me', {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(err => ({ data: null }))
        ]);
        
        setEvents(createdEventsResponse.data);
        setRegistrations(registrationHistoryResponse.data?.registrations || []);
        
        // Set organizer profile data
        if (organizerProfileResponse.data) {
          const org = organizerProfileResponse.data;
          setOrganizerCategory(org.category || '');
          setOrganizerDescription(org.description || '');
          setOrganizerContactEmail(org.contactemail || '');
          setDiscordWebhook(org.discordWebhook || '');
          setUserMobile(org.contactnumber || '');
          
          // Parse name into first/last
          const nameParts = org.name.split(' ');
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
        }
      }

    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Parallel API calls for faster update
      const updatePromises = [
        api.put('/auth/profile', 
          { 
            name: `${firstName} ${lastName}`,
            mobile: userMobile 
          }, 
          { headers: { Authorization: `Bearer ${token}` }}
        )
      ];
      
      // Add participant-specific updates
      if (userRole === 'participant') {
        updatePromises.push(
          api.put('/auth/participant', {
            firstName,
            lastName,
            contactNumber: userMobile,
            college,
            interests
          }, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          api.put('/auth/preferences', {
            followedclubs: followedClubs,
            interests
          }, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
      }
      
      // Add organizer-specific updates
      if (userRole === 'organizer') {
        updatePromises.push(
          api.put('/organizers/me', {
            name: `${firstName} ${lastName}`,
            category: organizerCategory,
            description: organizerDescription,
            contactemail: organizerContactEmail,
            contactnumber: userMobile,
            discordWebhook: discordWebhook
          }, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
      }
      
      await Promise.all(updatePromises);
      
      // Save new name locally
      await AsyncStorage.setItem('userName', `${firstName} ${lastName}`);
      setUserName(`${firstName} ${lastName}`);
      
      setIsEditing(false);
      if (Platform.OS === 'web') alert("✅ Profile Updated!");
      else Alert.alert("Success", "Profile Updated!");

    } catch (error) {
      console.error('Profile update error:', error);
      alert("Failed to update profile.");
    }
  };
  
  const toggleInterest = useCallback((interest) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  }, []);
  
  const handleUnfollowClub = useCallback(async (clubId) => {
    const updatedClubs = followedClubs.filter(id => id !== clubId);
    setFollowedClubs(updatedClubs);
    
    try {
      const token = await AsyncStorage.getItem('token');
      await api.put('/auth/preferences', {
        followedclubs: updatedClubs
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error unfollowing club:', error);
    }
  }, [followedClubs]);

  const handleCancelRegistration = async (ticketId, eventName) => {
    const confirmCancel = Platform.OS === 'web' 
      ? window.confirm(`Are you sure you want to cancel registration for "${eventName}"?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Cancel Registration',
            `Are you sure you want to cancel registration for "${eventName}"?`,
            [
              { text: 'No', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Yes', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });
    
    if (!confirmCancel) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      await api.put(`/registrations/cancel/${ticketId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh registrations
      await fetchData();
      
      if (Platform.OS === 'web') alert('Registration cancelled successfully');
      else Alert.alert('Success', 'Registration cancelled successfully');
    } catch (error) {
      console.error('Error cancelling registration:', error);
      const errorMsg = error.response?.data?.message || 'Failed to cancel registration';
      if (Platform.OS === 'web') alert(errorMsg);
      else Alert.alert('Error', errorMsg);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    if (Platform.OS === 'web') window.location.reload();
    else navigation.replace('Login');
  };

  // --- Memoized Filter Logic for better performance ---
  const filteredEvents = useMemo(() => {
    const now = new Date();
    return events.filter(item => {
      const eventDate = new Date(item.startdate);
      
      if (activeTab === 'MyEvents') {
        // For organizers, show all their created events
        return true;
      } else if (activeTab === 'Completed') {
        return eventDate < now && item.status !== 'Cancelled';
      }
      return true;
    });
  }, [events, activeTab]);

  const filteredRegistrations = useMemo(() => {
    const now = new Date();
    return registrations.filter(item => {
      const eventDate = new Date(item.eventDate);
      
      if (activeTab === 'Normal') {
        return item.eventType !== 'Merchandise' && (item.status === 'Registered' || item.status === 'Approved' || item.status === 'PendingApproval');
      } else if (activeTab === 'Merchandise') {
        return item.eventType === 'Merchandise' && (item.status === 'Registered' || item.status === 'Approved' || item.status === 'PendingApproval');
      } else if (activeTab === 'Completed') {
        return eventDate < now || item.status === 'Completed';
      } else if (activeTab === 'Cancelled') {
        return item.status === 'Cancelled' || item.status === 'Rejected';
      } else if (activeTab === 'MyTickets') {
        return eventDate >= now && item.status === 'Registered';
      }
      return true;
    });
  }, [registrations, activeTab]);

  return (
    <View style={styles.container}>
      <Navbar navigation={navigation} activeScreen="Profile" />
      
      <View style={styles.contentWrapper}>
        
        {/* --- HEADER SECTION (Avatar + Edit Profile) --- */}
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatar}>👤</Text>
          </View>

          {isEditing ? (
            <View style={styles.editContainer}>
              <View style={styles.editRow}>
                <TextInput 
                  style={[styles.editInput, styles.halfInput]} 
                  value={firstName} 
                  onChangeText={setFirstName} 
                  placeholder="First Name" 
                  placeholderTextColor="#ccc"
                />
                <TextInput 
                  style={[styles.editInput, styles.halfInput]} 
                  value={lastName} 
                  onChangeText={setLastName} 
                  placeholder="Last Name" 
                  placeholderTextColor="#ccc"
                />
              </View>
              <TextInput 
                style={styles.editInput} 
                value={userMobile} 
                onChangeText={setUserMobile} 
                placeholder="Contact Number" 
                keyboardType="phone-pad"
                placeholderTextColor="#ccc"
              />
              
              {userRole === 'participant' ? (
                <>
                  <TextInput 
                    style={styles.editInput} 
                    value={college} 
                    onChangeText={setCollege} 
                    placeholder="College/Organization" 
                    placeholderTextColor="#ccc"
                  />
                  
                  {/* Interests Selection */}
                  <Text style={styles.sectionLabel}>Select Interests:</Text>
                  <View style={styles.interestsContainer}>
                    {availableInterests.map(interest => (
                      <TouchableOpacity
                        key={interest}
                        style={[styles.interestChip, interests.includes(interest) && styles.interestChipSelected]}
                        onPress={() => toggleInterest(interest)}
                      >
                        <Text style={[styles.interestText, interests.includes(interest) && styles.interestTextSelected]}>
                          {interest}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  {/* Organizer-specific fields */}
                  <Text style={styles.sectionLabel}>📧 Login Email (Non-editable):</Text>
                  <View style={styles.nonEditableField}>
                    <Text style={styles.nonEditableText}>{userEmail || 'N/A'}</Text>
                  </View>
                  
                  <Text style={styles.sectionLabel}>📧 Contact Email:</Text>
                  <TextInput 
                    style={styles.editInput} 
                    value={organizerContactEmail} 
                    onChangeText={setOrganizerContactEmail} 
                    placeholder="organizer@example.com" 
                    keyboardType="email-address"
                    placeholderTextColor="#ccc"
                  />
                  
                  <Text style={styles.sectionLabel}>🏷️ Category:</Text>
                  <TextInput 
                    style={styles.editInput} 
                    value={organizerCategory} 
                    onChangeText={setOrganizerCategory} 
                    placeholder="e.g., Technical Club, Cultural Society" 
                    placeholderTextColor="#ccc"
                  />
                  
                  <Text style={styles.sectionLabel}>📝 Description:</Text>
                  <TextInput 
                    style={[styles.editInput, styles.textArea]} 
                    value={organizerDescription} 
                    onChangeText={setOrganizerDescription} 
                    placeholder="Tell us about your organization..." 
                    placeholderTextColor="#ccc"
                    multiline
                    numberOfLines={3}
                  />
                  
                  <Text style={styles.sectionLabel}>🔗 Discord Webhook (Optional):</Text>
                  <Text style={styles.helperText}>Automatically post new events to Discord</Text>
                  <TextInput 
                    style={styles.editInput} 
                    value={discordWebhook} 
                    onChangeText={setDiscordWebhook} 
                    placeholder="https://discord.com/api/webhooks/..." 
                    placeholderTextColor="#ccc"
                  />
                </>
              )}
              
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}>
                  <Text style={styles.saveBtnText}>💾 Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', width: '100%' }}>
              <View style={styles.nameRow}>
                <Text style={styles.title}>{userName}</Text>
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editIconBtn}>
                  <Text style={styles.editIcon}>✏️</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.subtitle}>Ready for Felicity 2026</Text>
              
              {/* Non-Editable Info Display */}
              {userRole === 'participant' && (
                <View style={styles.infoCards}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>📧 Email</Text>
                    <Text style={styles.infoValue}>{userEmail || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Type</Text>
                    <Text style={styles.infoValue}>{participantType || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>College</Text>
                    <Text style={styles.infoValue}>{college || 'Not set'}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Mobile</Text>
                    <Text style={styles.infoValue}>{userMobile || 'Not set'}</Text>
                  </View>
                </View>
              )}
              
              {/* Organizer Info Display */}
              {userRole === 'organizer' && (
                <View style={styles.infoCards}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Club Name</Text>
                    <Text style={styles.infoValue}>{userName || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Category</Text>
                    <Text style={styles.infoValue}>{organizerCategory || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Contact Email</Text>
                    <Text style={styles.infoValue}>{organizerContactEmail || userEmail || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Contact Number</Text>
                    <Text style={styles.infoValue}>{userMobile || 'Not set'}</Text>
                  </View>
                  {organizerDescription && (
                    <View style={[styles.infoCard, styles.fullWidthCard]}>
                      <Text style={styles.infoLabel}>Description</Text>
                      <Text style={styles.infoValue}>{organizerDescription}</Text>
                    </View>
                  )}
                  {discordWebhook && (
                    <View style={[styles.infoCard, styles.fullWidthCard]}>
                      <Text style={styles.infoLabel}>Discord Integration</Text>
                      <Text style={styles.infoValueSmall}>Configured</Text>
                    </View>
                  )}
                </View>
              )}
              
              {/* Interests Display */}
              {userRole === 'participant' && interests.length > 0 && (
                <View style={styles.interestsDisplay}>
                  <Text style={styles.interestsTitle}>Interests:</Text>
                  <View style={styles.interestsWrap}>
                    {interests.map(interest => (
                      <View key={interest} style={styles.interestTag}>
                        <Text style={styles.interestTagText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              
              {/* Followed Clubs Display */}
              {userRole === 'participant' && followedClubs.length > 0 && (
                <View style={styles.followedSection}>
                  <Text style={styles.followedTitle}>⭐ Following {followedClubs.length} club(s)</Text>
                  <Text style={styles.followedHint}>View in Clubs tab to manage</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* --- ACTION BUTTONS (Password Change & Logout) --- */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.passwordBtn}
            onPress={() => navigation.navigate('PasswordRequest')}
          >
            <Text style={styles.passwordBtnText}>Request Password Change</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* --- TABS SECTION --- */}
        <View style={styles.tabContainer}>
          {userRole === 'participant' ? (
            // Participant tabs - show tickets categorized
            ['Normal', 'Merchandise', 'Completed', 'Cancelled'].map((tab) => (
              <TouchableOpacity 
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === 'Normal' && 'Normal'}
                  {tab === 'Merchandise' && 'Merch'}
                  {tab === 'Completed' && 'Completed'}
                  {tab === 'Cancelled' && 'Cancelled'}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            // Organizer tabs - show both organized AND registered events
            ['MyEvents', 'MyTickets', 'Completed'].map((tab) => (
              <TouchableOpacity 
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === 'MyEvents' && 'Organizing'}
                  {tab === 'MyTickets' && 'Registered'}
                  {tab === 'Completed' && 'Completed'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* --- CONTENT SECTION --- */}
        {loading ? (
          <ActivityIndicator size="large" color="#ff006e" style={styles.loader} />
        ) : userRole === 'participant' ? (
          // Show registrations for participants
          filteredRegistrations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No registrations found</Text>
            </View>
          ) : (
            <FlatList
              data={filteredRegistrations}
              keyExtractor={(item) => item.ticketId}
              renderItem={({ item }) => (
                <View style={styles.ticketCard}>
                  {/* Ticket Header with Status */}
                  <View style={styles.ticketHeader}>
                    <View style={[styles.statusBadge, 
                      item.status === 'Registered' || item.status === 'Approved' ? styles.registeredBadge :
                      item.status === 'Completed' ? styles.completedBadge :
                      item.status === 'PendingApproval' ? styles.pendingBadge :
                      item.status === 'Rejected' ? styles.rejectedBadge :
                      styles.cancelledBadge
                    ]}>
                      <Text style={styles.statusText}>
                        {item.status === 'PendingApproval' ? 'Pending Approval' : item.status}
                      </Text>
                    </View>
                    <View style={[styles.typeBadge, item.eventType === 'Merchandise' ? styles.merchBadge : styles.normalBadge]}>
                      <Text style={styles.typeBadgeText}>
                        {item.eventType === 'Merchandise' ? 'MERCH' : 'EVENT'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Event Name */}
                  <Text style={styles.ticketEventName}>{item.eventName}</Text>
                  
                  {/* Organizer */}
                  <Text style={styles.ticketOrganizer}>{item.organizer || 'Unknown Organizer'}</Text>
                  
                  {/* Ticket Details Grid */}
                  <View style={styles.ticketDetails}>
                    <View style={styles.ticketDetailRow}>
                      <Text style={styles.ticketDetailLabel}>🎫 Ticket ID</Text>
                      <TouchableOpacity onPress={() => navigation.navigate('EventDetail', { eventId: item.eventId })}>
                        <Text style={styles.ticketIdLink}>{item.ticketId}</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {item.teamName && (
                      <View style={styles.ticketDetailRow}>
                        <Text style={styles.ticketDetailLabel}>👥 Team Name</Text>
                        <Text style={styles.ticketDetailValue}>{item.teamName}</Text>
                      </View>
                    )}
                    
                    <View style={styles.ticketDetailRow}>
                      <Text style={styles.ticketDetailLabel}>Event Date</Text>
                      <Text style={styles.ticketDetailValue}>
                        {new Date(item.eventDate).toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </Text>
                    </View>
                    
                    <View style={styles.ticketDetailRow}>
                      <Text style={styles.ticketDetailLabel}>📝 Registered On</Text>
                      <Text style={styles.ticketDetailValue}>
                        {new Date(item.registrationDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* QR Code Preview and Button - Only show when approved/completed */}
                  {item.qrCode && (item.status === 'Registered' || item.status === 'Approved' || item.status === 'Completed') && (
                    <View style={styles.qrSection}>
                      <Image 
                        source={{ uri: item.qrCode }} 
                        style={styles.qrCodePreview}
                        resizeMode="contain"
                      />
                      <TouchableOpacity 
                        style={styles.viewQRBtn}
                        onPress={() => {
                          setSelectedQR({ qrCode: item.qrCode, eventName: item.eventName, ticketId: item.ticketId });
                          setShowQRModal(true);
                        }}
                      >
                        <Text style={styles.viewQRBtnText}>🔍 View Full QR Code</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Upload Payment Proof button for PendingApproval merchandise */}
                  {item.status === 'PendingApproval' && item.eventType === 'Merchandise' && (
                    <TouchableOpacity 
                      style={styles.uploadProofBtn}
                      onPress={() => navigation.navigate('UploadPaymentProof', { 
                        ticketId: item.ticketId,
                        eventName: item.eventName 
                      })}
                    >
                      <Text style={styles.uploadProofBtnText}>📤 Upload Payment Proof</Text>
                    </TouchableOpacity>
                  )}

                  {/* Cancel Registration Button - Only show for Registered/Approved before event starts */}
                  {(item.status === 'Registered' || item.status === 'Approved') && new Date(item.eventDate) > new Date() && (
                    <TouchableOpacity 
                      style={styles.cancelBtn}
                      onPress={() => handleCancelRegistration(item.ticketId, item.eventName)}
                    >
                      <Text style={styles.cancelBtnText}>🚫 Cancel Registration</Text>
                    </TouchableOpacity>
                  )}

                  {/* Rejected status message */}
                  {item.status === 'Rejected' && (
                    <View style={styles.rejectedNote}>
                      <Text style={styles.rejectedNoteText}>
                        ⚠️ Payment was rejected. Please contact the organizer or try purchasing again.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            />
          )
        ) : (
          // Show content based on active tab for organizers
          activeTab === 'MyTickets' ? (
            // Show registered events (as participant)
            filteredRegistrations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No registered events</Text>
              </View>
            ) : (
              <FlatList
                data={filteredRegistrations}
                keyExtractor={(item) => item.ticketId}
                renderItem={({ item }) => (
                  <View style={styles.ticketCard}>
                    {/* Ticket Header with Status */}
                    <View style={styles.ticketHeader}>
                      <View style={[styles.statusBadge, 
                        item.status === 'Registered' ? styles.registeredBadge :
                        item.status === 'Completed' ? styles.completedBadge :
                        styles.cancelledBadge
                      ]}>
                        <Text style={styles.statusText}>
                          {item.status}
                        </Text>
                      </View>
                      <View style={[styles.typeBadge, item.eventType === 'Merchandise' ? styles.merchBadge : styles.normalBadge]}>
                        <Text style={styles.typeBadgeText}>
                          {item.eventType === 'Merchandise' ? 'MERCH' : 'EVENT'}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Event Name */}
                    <Text style={styles.ticketEventName}>{item.eventName}</Text>
                    
                    {/* Organizer */}
                    <Text style={styles.ticketOrganizer}>{item.organizer || 'Unknown Organizer'}</Text>
                    
                    {/* Ticket Details Grid */}
                    <View style={styles.ticketDetails}>
                      <View style={styles.ticketDetailRow}>
                        <Text style={styles.ticketDetailLabel}>Ticket ID</Text>
                        <Text style={styles.ticketDetailValue}>{item.ticketId}</Text>
                      </View>
                      
                      <View style={styles.ticketDetailRow}>
                        <Text style={styles.ticketDetailLabel}>Event Date</Text>
                        <Text style={styles.ticketDetailValue}>
                          {new Date(item.eventDate).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </Text>
                      </View>
                      
                      <View style={styles.ticketDetailRow}>
                        <Text style={styles.ticketDetailLabel}>📝 Registered On</Text>
                        <Text style={styles.ticketDetailValue}>
                          {new Date(item.registrationDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                    </View>

                    {/* QR Code Preview and Button */}
                    {item.qrCode && (
                      <View style={styles.qrSection}>
                        <Image 
                          source={{ uri: item.qrCode }} 
                          style={styles.qrCodePreview}
                          resizeMode="contain"
                        />
                        <TouchableOpacity 
                          style={styles.viewQRBtn}
                          onPress={() => {
                            setSelectedQR({ qrCode: item.qrCode, eventName: item.eventName, ticketId: item.ticketId });
                            setShowQRModal(true);
                          }}
                        >
                          <Text style={styles.viewQRBtnText}>🔍 View Full QR Code</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              />
            )
          ) : (
            // Show created events for organizers (MyEvents or Completed tabs)
            filteredEvents.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No events yet</Text>
              </View>
            ) : (
              <FlatList
                data={filteredEvents}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                  const isMerch = item.type === 'Merchandise';
                  const participantCount = item.participants?.length || 0;
                  let revenue = 0;
                  
                  if (item.type === 'Normal' && item.registrationFee) {
                    revenue = participantCount * item.registrationFee;
                  } else if (item.type === 'Merchandise' && item.price) {
                    revenue = participantCount * item.price;
                  }
                  
                  return (
                    <TouchableOpacity 
                      style={[styles.card, { borderLeftColor: isMerch ? '#ff9800' : '#8338ec' }]}
                      onPress={() => navigation.navigate('EventDetail', { eventId: item._id })}
                    >
                      <View style={styles.eventIcon}>
                      </View>
                      
                      <View style={styles.eventInfo}>
                        <View style={styles.eventNameRow}>
                          <Text style={styles.eventName}>{item.name}</Text>
                          <View style={[styles.statusBadge2, 
                            item.status === 'Published' ? styles.publishedBadge2 :
                            item.status === 'Draft' ? styles.draftBadge2 :
                            item.status === 'Ongoing' ? styles.ongoingBadge2 :
                            styles.closedBadge2
                          ]}>
                            <Text style={styles.statusBadgeText2}>{item.status}</Text>
                          </View>
                        </View>
                        
                        <Text style={styles.eventType}>{item.type}</Text>
                        
                        <View style={styles.dateRow}>
                          <Text style={styles.eventDate}>
                            {item.startdate ? new Date(item.startdate).toDateString() : "Date TBA"}
                          </Text>
                        </View>

                        <View style={styles.statsRow}>
                          <Text style={styles.statText}>{participantCount} registered</Text>
                          {revenue > 0 && (
                            <Text style={styles.revenueText}>💰 ₹{revenue}</Text>
                          )}
                        </View>

                        {isMerch && (
                          <View style={styles.priceTag}>
                            <Text style={styles.priceText}>Unit Price: ₹{item.price}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.actionBtn}>
                        <Text style={styles.actionText}>View →</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.list}
              />
            )
          )
        )}
      </View>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedQR?.eventName}</Text>
            <Text style={styles.modalTicketId}>Ticket: {selectedQR?.ticketId}</Text>
            
            {selectedQR?.qrCode && (
              <Image 
                source={{ uri: selectedQR.qrCode }} 
                style={styles.qrCodeFull}
                resizeMode="contain"
              />
            )}
            
            <Text style={styles.qrInstructions}>
              📱 Show this QR code at the event entrance
            </Text>
            
            <TouchableOpacity 
              style={styles.closeModalBtn}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  contentWrapper: { flex: 1 },
  
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 0,
    backgroundColor: '#f5f5f5',
    borderWidth: 1, borderColor: '#d0d0d0',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 15
  },
  avatar: { fontSize: 40 },
  
  // Name & Edit
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '600', color: '#1a1a1a', letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: '#666666', fontWeight: '500' },
  editIconBtn: { backgroundColor: '#ffffff', padding: 5, borderRadius: 0, borderWidth: 1, borderColor: '#d0d0d0' },
  editIcon: { fontSize: 14 },

  // Edit Form
  editContainer: { width: '100%', alignItems: 'center', paddingHorizontal: 24 },
  editRow: { 
    flexDirection: 'row', 
    gap: 12, 
    width: Platform.OS === 'web' ? 500 : '100%',
    marginBottom: 12 
  },
  editInput: { 
    width: Platform.OS === 'web' ? 500 : '100%', 
    backgroundColor: '#ffffff', 
    color: '#1a1a1a', 
    padding: 12, 
    borderWidth: 1, 
    borderColor: '#d0d0d0', 
    borderRadius: 0, 
    marginBottom: 12, 
    fontSize: 14
  },
  halfInput: {
    flex: 1,
    width: 'auto'
  },
  sectionLabel: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    alignSelf: 'flex-start',
    width: Platform.OS === 'web' ? 500 : '100%',
    letterSpacing: 0.3
  },
  helperText: {
    color: '#666666',
    fontSize: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: Platform.OS === 'web' ? 500 : '100%'
  },
  nonEditableField: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    width: Platform.OS === 'web' ? 500 : '100%',
  },
  nonEditableText: {
    color: '#666666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    width: Platform.OS === 'web' ? 500 : '100%'
  },
  interestChip: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  interestChipSelected: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a'
  },
  interestText: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3
  },
  interestTextSelected: {
    color: '#ffffff'
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtn: { backgroundColor: '#1a1a1a', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 0 },
  saveBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 14, letterSpacing: 0.5 },
  cancelBtn: { backgroundColor: '#ffffff', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 0, borderWidth: 1, borderColor: '#d0d0d0' },
  cancelBtnText: { color: '#666666', fontSize: 14, fontWeight: '500' },
  
  // Info Cards (Non-Editable Display)
  infoCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24
  },
  infoCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 0,
    minWidth: Platform.OS === 'web' ? 200 : 150,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderLeftWidth: 3,
    borderLeftColor: '#1a1a1a'
  },
  infoLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  infoValue: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600'
  },
  infoValueSmall: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '500'
  },
  fullWidthCard: {
    width: '90%',
    marginTop: 12
  },
  
  // Interests Display
  interestsDisplay: {
    marginTop: 16,
    width: '90%',
    alignItems: 'center'
  },
  interestsTitle: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.3
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center'
  },
  interestTag: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  interestTagText: {
    color: '#1a1a1a',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3
  },
  
  // Followed Clubs Display
  followedSection: {
    marginTop: 16,
    alignItems: 'center'
  },
  followedTitle: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600'
  },
  followedHint: {
    color: '#888888',
    fontSize: 11,
    marginTop: 3
  },
  // Action Buttons (Password Change & Logout)
  actionsContainer: {
    width: Platform.OS === 'web' ? 600 : '100%',
    alignSelf: 'center',
    marginBottom: 16,
    gap: 12
  },
  passwordBtn: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 0,
    alignItems: 'center'
  },
  passwordBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5
  },
  logoutBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  logoutBtnText: {
    color: '#666666',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5
  },
  // Tabs
  tabContainer: { 
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff', 
    borderRadius: 0, 
    padding: 0, 
    marginBottom: 20,
    marginHorizontal: 24,
    gap: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  tab: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    borderRadius: 0,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0'
  },
  activeTab: {
    backgroundColor: '#1a1a1a',
  },
  tabText: { color: '#666666', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  activeTabText: { color: '#ffffff' },

  // List & Cards
  loaderContainer: { marginTop: 50, alignItems: 'center' },
  emptyContainer: { marginTop: 50, alignItems: 'center' },
  emptyEmoji: { display: 'none' },
  noEvents: { color: '#666666', fontSize: 16, fontWeight: '500' },
  
  list: { paddingBottom: 30, paddingHorizontal: 24 },
  card: { 
    backgroundColor: '#ffffff',
    padding: 16, marginBottom: 16, borderRadius: 0,
    width: '100%',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderLeftWidth: 3,
    borderLeftColor: '#1a1a1a'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventIcon: {
    width: 50, height: 50, borderRadius: 0,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginRight: 16,
    borderWidth: 1, borderColor: '#d0d0d0'
  },
  iconEmoji: { fontSize: 24 },
  eventInfo: { flex: 1 },
  eventNameRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 6 
  },
  eventName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1, letterSpacing: 0.3 },
  eventType: { fontSize: 12, color: '#666666', fontWeight: '500', marginBottom: 4 },
  organizerName: { fontSize: 13, color: '#888888', marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  calendarIcon: { display: 'none' },
  eventDate: { fontSize: 13, color: '#888888', fontWeight: '500' },
  
  // Status Badge
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 0,
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  statusText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  
  // Ticket ID Style (Clickable)
  ticketIdContainer: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 0,
    alignSelf: 'flex-start',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  ticketId: { 
    fontSize: 12, 
    color: '#1a1a1a', 
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5
  },

  priceTag: { backgroundColor: '#f5f5f5', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 0, alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderColor: '#d0d0d0' },
  priceText: { color: '#1a1a1a', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  
  // Ticket Card Styles
  ticketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderLeftWidth: 3,
    borderLeftColor: '#1a1a1a'
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  typeBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 0,
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  normalBadge: {
    backgroundColor: '#f5f5f5',
  },
  merchBadge: {
    backgroundColor: '#f5f5f5',
  },
  typeBadgeText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3
  },
  registeredBadge: {
    backgroundColor: '#f5f5f5',
  },
  completedBadge: {
    backgroundColor: '#f5f5f5',
  },
  cancelledBadge: {
    backgroundColor: '#f5f5f5',
  },
  ticketEventName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    letterSpacing: 0.3
  },
  ticketOrganizer: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16
  },
  ticketDetails: {
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  ticketDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  ticketDetailLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '600'
  },
  ticketDetailValue: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  ticketIdLink: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textDecorationLine: 'underline',
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  qrCodePreview: {
    width: 120,
    height: 120,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 0,
    padding: 8,
    backgroundColor: '#ffffff',
    marginBottom: 12
  },
  viewQRBtn: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 0
  },
  viewQRBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  
  // QR Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 30,
    alignItems: 'center',
    width: Platform.OS === 'web' ? 450 : '90%',
    maxWidth: 500,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3
  },
  modalTicketId: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrCodeFull: {
    width: 300,
    height: 300,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 0,
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24
  },
  closeModalBtn: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 0,
    width: '100%',
  },
  closeModalBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  createEventBtn: {
    backgroundColor: '#8338ec',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 15,
  },
  createEventBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventType: {
    fontSize: 12,
    color: '#8338ec',
    fontWeight: '600',
    marginBottom: 5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 5,
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  revenueText: {
    fontSize: 13,
    color: '#4caf50',
    fontWeight: 'bold',
  },
  actionBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  actionText: {
    fontSize: 18,
    color: '#8338ec',
    fontWeight: 'bold',
  },
  statusBadge2: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishedBadge2: {
    backgroundColor: '#4caf50',
  },
  draftBadge2: {
    backgroundColor: '#ff9800',
  },
  ongoingBadge2: {
    backgroundColor: '#2196f3',
  },
  closedBadge2: {
    backgroundColor: '#f44336',
  },
  statusBadgeText2: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusText2: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // New Status Badges
  pendingBadge: {
    backgroundColor: '#ffd60a',
  },
  rejectedBadge: {
    backgroundColor: '#ef476f',
  },

  // Upload Payment Proof Button
  uploadProofBtn: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 0,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  uploadProofBtnText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 14,
  },

  // Cancel Registration Button
  cancelBtn: {
    backgroundColor: '#ff006e',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Rejected Note
  rejectedNote: {
    backgroundColor: 'rgba(239, 71, 111, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 71, 111, 0.3)',
  },
  rejectedNoteText: {
    color: '#ef476f',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default ProfileScreen;