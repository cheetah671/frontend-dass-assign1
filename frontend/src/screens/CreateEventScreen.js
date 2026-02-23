import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Alert, Modal } from 'react-native';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Navbar from '../../components/Navbar';

const CreateEventScreen = ({ navigation, route }) => {
  const { eventId, editMode } = route.params || {};
  const [isEditMode, setIsEditMode] = useState(editMode || false);
  const [originalEvent, setOriginalEvent] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'Normal',
    eligibility: 'Open to all',
    startdate: '',
    enddate: '',
    registrationdeadline: '',
    registrationLimit: '',
    registrationFee: '',
    eventTags: [],
    status: 'Draft', // Default to Draft
    // Team registration fields
    allowTeamRegistration: false,
    minTeamSize: '2',
    maxTeamSize: '5',
    teamName: '',
    // Merchandise fields
    price: '',
    stock: '',
    purchaseLimit: '1',
    sizes: '',
    colors: '',
    variants: '',
    // Normal event fields
    formFields: []
  });

  const [currentTag, setCurrentTag] = useState('');
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [currentField, setCurrentField] = useState({ 
    fieldName: '', 
    fieldType: 'text', 
    required: false,
    options: [] // For dropdown/radio
  });
  const [currentOption, setCurrentOption] = useState('');
  
  useEffect(() => {
    checkUserRole();
    if (isEditMode && eventId) {
      loadEventData();
    }
  }, []);
  
  const loadEventData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const event = response.data;
      setOriginalEvent(event);
      
      // Populate form with existing data
      setFormData({
        name: event.name || '',
        description: event.description || '',
        type: event.type || 'Normal',
        eligibility: event.eligibility || 'Open to all',
        startdate: event.startdate ? new Date(event.startdate).toISOString().split('T')[0] : '',
        enddate: event.enddate ? new Date(event.enddate).toISOString().split('T')[0] : '',
        registrationdeadline: event.registrationdeadline ? new Date(event.registrationdeadline).toISOString().split('T')[0] : '',
        registrationLimit: event.registrationLimit?.toString() || '',
        registrationFee: event.registrationFee?.toString() || '',
        eventTags: event.eventTags || [],
        status: event.status || 'Draft',
        // Team registration
        allowTeamRegistration: event.allowTeamRegistration || false,
        minTeamSize: event.minTeamSize?.toString() || '2',
        maxTeamSize: event.maxTeamSize?.toString() || '5',
        teamName: event.teamName || '',
        // Merchandise
        price: event.price?.toString() || '',
        stock: event.stock?.toString() || '',
        purchaseLimit: event.purchaseLimit?.toString() || '1',
        sizes: event.itemDetails?.sizes?.join(', ') || '',
        colors: event.itemDetails?.colors?.join(', ') || '',
        variants: event.itemDetails?.variants?.join(', ') || '',
        formFields: event.formFields || []
      });
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Error', 'Failed to load event data');
    }
  };
  
  const checkUserRole = async () => {
    const role = await AsyncStorage.getItem('userRole');
    console.log('User role:', role);
    
    if (role !== 'organizer') {
      Alert.alert(
        'Access Denied',
        'Only organizers can create events. Please contact admin to get organizer access.',
        [{ text: 'Go Back', onPress: () => navigation.goBack() }]
      );
    }
  };

  const availableTags = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Competition', 'Talk', 'Performance'];
  const fieldTypes = [
    { label: 'Text Input', value: 'text' },
    { label: 'Number', value: 'number' },
    { label: 'Email', value: 'email' },
    { label: 'Phone', value: 'phone' },
    { label: 'Dropdown', value: 'dropdown' },
    { label: 'Radio Buttons', value: 'radio' },
    { label: 'Checkbox', value: 'checkbox' },
    { label: 'Text Area', value: 'textarea' },
    { label: 'File Upload', value: 'file' }
  ];

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addTag = (tag) => {
    if (!formData.eventTags.includes(tag)) {
      setFormData(prev => ({ ...prev, eventTags: [...prev.eventTags, tag] }));
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({ ...prev, eventTags: prev.eventTags.filter(t => t !== tag) }));
  };

  const addFormField = () => {
    if (currentField.fieldName) {
      const newField = { ...currentField };
      
      // For dropdown/radio, ensure options are set
      if ((currentField.fieldType === 'dropdown' || currentField.fieldType === 'radio') && currentField.options.length === 0) {
        Alert.alert('Error', 'Please add at least one option for this field type');
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        formFields: [...prev.formFields, newField]
      }));
      setCurrentField({ fieldName: '', fieldType: 'text', required: false, options: [] });
      setShowFormBuilder(false);
    }
  };

  const removeFormField = (index) => {
    setFormData(prev => ({
      ...prev,
      formFields: prev.formFields.filter((_, i) => i !== index)
    }));
  };

  const moveFormField = (index, direction) => {
    const newFields = [...formData.formFields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFormData(prev => ({ ...prev, formFields: newFields }));
  };

  const addOption = () => {
    if (currentOption.trim()) {
      setCurrentField(prev => ({
        ...prev,
        options: [...prev.options, currentOption.trim()]
      }));
      setCurrentOption('');
    }
  };

  const removeOption = (index) => {
    setCurrentField(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const missingFields = [];
    
    if (!formData.name) missingFields.push('Event Name');
    if (!formData.description) missingFields.push('Description');
    if (!formData.startdate) missingFields.push('Start Date');
    if (!formData.enddate) missingFields.push('End Date');
    if (!formData.registrationdeadline) missingFields.push('Registration Deadline');
    
    if (missingFields.length > 0) {
      const msg = 'Missing: ' + missingFields.join(', ');
      console.log('Validation failed:', msg);
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Missing Fields', msg);
      }
      return false;
    }

    if (formData.type === 'Merchandise') {
      if (!formData.price || !formData.stock) {
        const msg = 'Merchandise must have Price and Stock';
        console.log('Validation failed:', msg);
        if (Platform.OS === 'web') {
          alert(msg);
        } else {
          Alert.alert('Missing Fields', msg);
        }
        return false;
      }
    }

    console.log('Validation passed!');
    return true;
  };

  const handleSubmit = async (saveAsDraft = false) => {
    console.log('Submit button clicked, draft:', saveAsDraft, 'editMode:', isEditMode);
    
    if (!validateForm()) {
      console.log('Validation failed');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      console.log('Token retrieved:', token ? 'exists' : 'missing');

      if (!token) {
        Alert.alert('Error', 'You must be logged in to create events');
        return;
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        eligibility: formData.eligibility,
        startdate: new Date(formData.startdate),
        enddate: new Date(formData.enddate),
        registrationdeadline: new Date(formData.registrationdeadline),
        registrationLimit: Number(formData.registrationLimit) || 0,
        registrationFee: Number(formData.registrationFee) || 0,
        eventTags: formData.eventTags,
        status: saveAsDraft ? 'Draft' : 'Published'
      };

      // Add team registration fields for Normal events
      if (formData.type === 'Normal') {
        payload.allowTeamRegistration = formData.allowTeamRegistration || false;
        if (formData.allowTeamRegistration) {
          payload.minTeamSize = Number(formData.minTeamSize) || 2;
          payload.maxTeamSize = Number(formData.maxTeamSize) || 5;
          payload.teamName = formData.teamName || '';
        }
      }

      if (formData.type === 'Merchandise') {
        payload.price = Number(formData.price) || 0;
        payload.stock = Number(formData.stock) || 0;
        payload.purchaseLimit = Number(formData.purchaseLimit) || 1;
        payload.itemDetails = {
          sizes: formData.sizes ? formData.sizes.split(',').map(s => s.trim()) : [],
          colors: formData.colors ? formData.colors.split(',').map(c => c.trim()) : [],
          variants: formData.variants ? formData.variants.split(',').map(v => v.trim()) : []
        };
      } else {
        payload.formFields = formData.formFields;
      }

      console.log('Sending payload:', JSON.stringify(payload, null, 2));

      let response;
      if (isEditMode && eventId) {
        // Update existing event
        response = await api.put(`/events/${eventId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create new event
        response = await api.post('/events', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      console.log('Event saved successfully:', response.data);

      const successMessage = isEditMode 
        ? 'Event updated successfully!' 
        : (saveAsDraft ? 'Event saved as draft!' : 'Event Published Successfully!');
      
      if (Platform.OS === 'web') {
        alert('Success: ' + successMessage);
        navigation.replace('Home');
      } else {
        Alert.alert('Success', successMessage, [
          { text: 'OK', onPress: () => navigation.replace('Home') }
        ]);
      }

    } catch (error) {
      console.error("Creation/Update Error:", error);
      console.error("Error response:", error.response?.data);
      
      const errorMsg = error.response?.data?.message || error.message || `Failed to ${isEditMode ? 'update' : 'create'} event`;
      
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Navbar navigation={navigation} activeScreen="CreateEvent" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Event' : 'Create Event'}</Text>
          {isEditMode && originalEvent?.status === 'Draft' && (
            <Text style={styles.draftNotice}>Editing Draft - Full editing available</Text>
          )}
          {isEditMode && originalEvent?.status === 'Published' && (
            <Text style={styles.limitedEditNotice}>Limited editing - Only description, deadline, and limit can be changed</Text>
          )}
        </View>

        <View style={styles.form}>
          {/* Event Type */}
          <Text style={styles.sectionTitle}>Event Type</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[styles.typeButton, formData.type === 'Normal' && styles.activeType]}
              onPress={() => handleChange('type', 'Normal')}
            >
              <Text style={styles.typeEmoji}>🎪</Text>
              <Text style={styles.typeText}>Normal Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, formData.type === 'Merchandise' && styles.activeType]}
              onPress={() => handleChange('type', 'Merchandise')}
            >
              <Text style={styles.typeEmoji}>👕</Text>
              <Text style={styles.typeText}>Merchandise</Text>
            </TouchableOpacity>
          </View>

          {/* Basic Info */}
          <Text style={styles.label}>Event Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter event name"
            placeholderTextColor="#999"
            value={formData.name}
            onChangeText={(text) => handleChange('name', text)}
          />

          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your event"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={formData.description}
            onChangeText={(text) => handleChange('description', text)}
          />

          <Text style={styles.label}>Eligibility *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Open to all, IIIT students only"
            placeholderTextColor="#999"
            value={formData.eligibility}
            onChangeText={(text) => handleChange('eligibility', text)}
          />

          {/* Team Registration */}
          {formData.type === 'Normal' && (
            <View style={styles.teamRegistrationSection}>
              <TouchableOpacity 
                style={styles.teamCheckboxContainer}
                onPress={() => handleChange('allowTeamRegistration', !formData.allowTeamRegistration)}
              >
                <View style={[styles.checkboxSquare, formData.allowTeamRegistration && styles.checkboxSquareChecked]}>
                  {formData.allowTeamRegistration && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Allow Team Registration</Text>
              </TouchableOpacity>

              {formData.allowTeamRegistration && (
                <View style={styles.teamSizeRow}>
                  <View style={styles.teamSizeField}>
                    <Text style={styles.label}>Min Team Size</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="2"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={formData.minTeamSize}
                      onChangeText={(text) => handleChange('minTeamSize', text)}
                    />
                  </View>
                  <View style={styles.teamSizeField}>
                    <Text style={styles.label}>Max Team Size</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="5"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={formData.maxTeamSize}
                      onChangeText={(text) => handleChange('maxTeamSize', text)}
                    />
                  </View>
                </View>
              )}

              {formData.allowTeamRegistration && (
                <View>
                  <Text style={styles.label}>Team Name (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Team Alpha, Squad 7"
                    placeholderTextColor="#999"
                    value={formData.teamName}
                    onChangeText={(text) => handleChange('teamName', text)}
                  />
                </View>
              )}
            </View>
          )}

          {/* Dates */}
          <Text style={styles.label}>Start Date * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-03-15"
            placeholderTextColor="#999"
            value={formData.startdate}
            onChangeText={(text) => handleChange('startdate', text)}
          />

          <Text style={styles.label}>End Date * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-03-16"
            placeholderTextColor="#999"
            value={formData.enddate}
            onChangeText={(text) => handleChange('enddate', text)}
          />

          <Text style={styles.label}>Registration Deadline * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2026-03-10"
            placeholderTextColor="#999"
            value={formData.registrationdeadline}
            onChangeText={(text) => handleChange('registrationdeadline', text)}
          />

          <Text style={styles.label}>Registration Limit (0 = Unlimited)</Text>
          <TextInput
            style={styles.input}
            placeholder="100"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={formData.registrationLimit}
            onChangeText={(text) => handleChange('registrationLimit', text)}
          />

          <Text style={styles.label}>Registration Fee (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={formData.registrationFee}
            onChangeText={(text) => handleChange('registrationFee', text)}
          />

          {/* Event Tags */}
          <Text style={styles.label}>Event Tags</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
            {availableTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, formData.eventTags.includes(tag) && styles.tagChipActive]}
                onPress={() => formData.eventTags.includes(tag) ? removeTag(tag) : addTag(tag)}
              >
                <Text style={[styles.tagText, formData.eventTags.includes(tag) && styles.tagTextActive]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Merchandise-specific fields */}
          {formData.type === 'Merchandise' && (
            <>
              <Text style={styles.sectionTitle}>Merchandise Details</Text>
              
              <Text style={styles.label}>Price * (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="299"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={formData.price}
                onChangeText={(text) => handleChange('price', text)}
              />

              <Text style={styles.label}>Stock Quantity *</Text>
              <TextInput
                style={styles.input}
                placeholder="100"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={formData.stock}
                onChangeText={(text) => handleChange('stock', text)}
              />

              <Text style={styles.label}>Purchase Limit per Participant</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={formData.purchaseLimit}
                onChangeText={(text) => handleChange('purchaseLimit', text)}
              />

              <Text style={styles.label}>Available Sizes (comma-separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="S, M, L, XL"
                placeholderTextColor="#999"
                value={formData.sizes}
                onChangeText={(text) => handleChange('sizes', text)}
              />

              <Text style={styles.label}>Available Colors (comma-separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="Red, Blue, Black"
                placeholderTextColor="#999"
                value={formData.colors}
                onChangeText={(text) => handleChange('colors', text)}
              />

              <Text style={styles.label}>Variants (comma-separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="Hoodie, T-Shirt"
                placeholderTextColor="#999"
                value={formData.variants}
                onChangeText={(text) => handleChange('variants', text)}
              />
            </>
          )}

          {/* Normal Event - Form Builder */}
          {formData.type === 'Normal' && (
            <>
              <Text style={styles.sectionTitle}>Custom Registration Form</Text>
              <Text style={styles.sectionSubtitle}>Create custom fields for event registration</Text>
              <TouchableOpacity style={styles.addFieldButton} onPress={() => setShowFormBuilder(true)}>
                <Text style={styles.addFieldText}>+ Add Form Field</Text>
              </TouchableOpacity>

              {formData.formFields.map((field, index) => (
                <View key={index} style={styles.formFieldPreview}>
                  <View style={styles.fieldInfo}>
                    <Text style={styles.formFieldName}>
                      {field.fieldName} ({field.fieldType})
                      {field.required && <Text style={styles.requiredStar}> *</Text>}
                    </Text>
                    {(field.fieldType === 'dropdown' || field.fieldType === 'radio') && field.options && (
                      <Text style={styles.optionsText}>Options: {field.options.join(', ')}</Text>
                    )}
                  </View>
                  <View style={styles.fieldActions}>
                    {index > 0 && (
                      <TouchableOpacity onPress={() => moveFormField(index, 'up')} style={styles.moveBtn}>
                        <Text style={styles.moveBtnText}>↑</Text>
                      </TouchableOpacity>
                    )}
                    {index < formData.formFields.length - 1 && (
                      <TouchableOpacity onPress={() => moveFormField(index, 'down')} style={styles.moveBtn}>
                        <Text style={styles.moveBtnText}>↓</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => removeFormField(index)} style={styles.removeBtn}>
                      <Text style={styles.removeField}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.submitButton, styles.draftButton]} 
              onPress={() => handleSubmit(true)}
            >
              <Text style={styles.submitText}>💾 Save as Draft</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.submitButton, styles.publishButton]} 
              onPress={() => handleSubmit(false)}
            >
              <Text style={styles.submitText}>🚀 Publish Event</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Enhanced Form Builder Modal */}
      <Modal visible={showFormBuilder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Custom Form Field</Text>

            <Text style={styles.label}>Field Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Team Name, T-Shirt Size"
              placeholderTextColor="#999"
              value={currentField.fieldName}
              onChangeText={(text) => setCurrentField({ ...currentField, fieldName: text })}
            />

            <Text style={styles.label}>Field Type *</Text>
            <ScrollView style={styles.fieldTypeScroll} horizontal showsHorizontalScrollIndicator={false}>
              {fieldTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[styles.fieldTypeButton, currentField.fieldType === type.value && styles.activeFieldType]}
                  onPress={() => setCurrentField({ ...currentField, fieldType: type.value, options: [] })}
                >
                  <Text style={[styles.fieldTypeText, currentField.fieldType === type.value && styles.activeFieldTypeText]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Options for Dropdown/Radio */}
            {(currentField.fieldType === 'dropdown' || currentField.fieldType === 'radio') && (
              <View style={styles.optionsSection}>
                <Text style={styles.label}>Options *</Text>
                <View style={styles.optionInputRow}>
                  <TextInput
                    style={[styles.input, styles.optionInput]}
                    placeholder="Add an option"
                    placeholderTextColor="#999"
                    value={currentOption}
                    onChangeText={setCurrentOption}
                  />
                  <TouchableOpacity style={styles.addOptionBtn} onPress={addOption}>
                    <Text style={styles.addOptionText}>+</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.optionsList}>
                  {currentField.options.map((option, index) => (
                    <View key={index} style={styles.optionItem}>
                      <Text style={styles.optionItemText}>{option}</Text>
                      <TouchableOpacity onPress={() => removeOption(index)}>
                        <Text style={styles.removeOption}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setCurrentField({ ...currentField, required: !currentField.required })}
            >
              <View style={[styles.checkbox, currentField.required && styles.checkboxActive]}>
                {currentField.required && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Required Field</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={addFormField}>
                <Text style={styles.modalButtonText}>Add Field</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowFormBuilder(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 30 },
  headerEmoji: { display: 'none' },
  headerTitle: { fontSize: 28, fontWeight: '600', color: '#1a1a1a', letterSpacing: 0.3 },
  draftNotice: { fontSize: 14, color: '#666666', marginTop: 10, textAlign: 'center' },
  limitedEditNotice: { fontSize: 14, color: '#666666', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  form: { backgroundColor: '#ffffff', borderRadius: 0, padding: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginTop: 20, marginBottom: 10, letterSpacing: 0.3 },
  label: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#ffffff', borderRadius: 0, padding: 12, fontSize: 16, color: '#1a1a1a', borderWidth: 1, borderColor: '#d0d0d0' },
  textArea: { height: 100, textAlignVertical: 'top' },
  typeContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeButton: { flex: 1, padding: 15, borderRadius: 0, borderWidth: 1, borderColor: '#d0d0d0', alignItems: 'center', backgroundColor: '#ffffff' },
  activeType: { borderColor: '#1a1a1a', backgroundColor: '#f5f5f5' },
  typeEmoji: { display: 'none' },
  typeText: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  tagsScroll: { marginBottom: 10 },
  tagChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 0, backgroundColor: '#ffffff', marginRight: 8, borderWidth: 1, borderColor: '#d0d0d0' },
  tagChipActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  tagText: { color: '#1a1a1a', fontSize: 14 },
  tagTextActive: { color: '#ffffff', fontWeight: '600' },
  addFieldButton: { backgroundColor: '#1a1a1a', padding: 12, borderRadius: 0, alignItems: 'center', marginBottom: 10 },
  addFieldText: { color: '#ffffff', fontWeight: '600', letterSpacing: 0.5 },
  formFieldPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f5f5f5', borderRadius: 0, marginBottom: 8, borderLeftWidth: 2, borderLeftColor: '#1a1a1a' },
  fieldInfo: { flex: 1 },
  formFieldName: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  requiredStar: { color: '#1a1a1a', fontWeight: '600' },
  optionsText: { fontSize: 12, color: '#666666', marginTop: 3 },
  fieldActions: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  moveBtn: { backgroundColor: '#f5f5f5', padding: 5, borderRadius: 0, width: 30, alignItems: 'center', borderWidth: 1, borderColor: '#d0d0d0' },
  moveBtnText: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  removeBtn: { backgroundColor: '#ffffff', padding: 5, borderRadius: 0, width: 30, alignItems: 'center', marginLeft: 5, borderWidth: 1, borderColor: '#d0d0d0' },
  removeField: { fontSize: 18, color: '#1a1a1a', fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 30 },
  draftButton: { flex: 1, backgroundColor: '#666666' },
  publishButton: { flex: 1, backgroundColor: '#1a1a1a' },
  sectionSubtitle: { fontSize: 12, color: '#666666', marginBottom: 10, marginTop: -5 },
  submitButton: { padding: 15, borderRadius: 0, alignItems: 'center' },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
  cancelButton: { alignItems: 'center', marginTop: 15, padding: 10 },
  cancelText: { color: '#666666', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 0, padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: '#d0d0d0' },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#1a1a1a', marginBottom: 20, letterSpacing: 0.3 },
  fieldTypeScroll: { maxHeight: 60, marginBottom: 15 },
  fieldTypeContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  fieldTypeButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 0, borderWidth: 1, borderColor: '#d0d0d0', backgroundColor: '#ffffff', alignItems: 'center' },
  activeFieldType: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  fieldTypeText: { color: '#1a1a1a', fontSize: 13, fontWeight: '600' },
  activeFieldTypeText: { color: '#ffffff' },
  optionsSection: { marginBottom: 15, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 0, borderWidth: 1, borderColor: '#e0e0e0' },
  optionInputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  optionInput: { flex: 1 },
  addOptionBtn: { backgroundColor: '#1a1a1a', paddingHorizontal: 20, borderRadius: 0, justifyContent: 'center', alignItems: 'center' },
  addOptionText: { color: '#ffffff', fontSize: 24, fontWeight: '600' },
  optionsList: { gap: 5 },
  optionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 10, borderRadius: 0, borderWidth: 1, borderColor: '#e0e0e0' },
  optionItemText: { fontSize: 14, color: '#1a1a1a' },
  removeOption: { fontSize: 18, color: '#1a1a1a', fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 0, marginRight: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  checkboxActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  checkmark: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  checkboxLabel: { fontSize: 16, color: '#1a1a1a', fontWeight: '600' },
  checkboxText: { fontSize: 16, color: '#1a1a1a' },
  
  // Team Registration Styles
  teamRegistrationSection: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 0,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  teamCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  checkboxSquare: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  checkboxSquareChecked: {
    backgroundColor: '#1a1a1a'
  },
  teamSizeRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10
  },
  teamSizeField: {
    flex: 1
  },
  
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalButton: { flex: 1, backgroundColor: '#1a1a1a', padding: 12, borderRadius: 0, alignItems: 'center' },
  modalButtonText: { color: '#ffffff', fontWeight: '600', letterSpacing: 0.5 },
  modalCancelButton: { flex: 1, backgroundColor: '#ffffff', padding: 12, borderRadius: 0, alignItems: 'center', borderWidth: 1, borderColor: '#d0d0d0' },
  modalCancelText: { color: '#1a1a1a', fontWeight: '600' },
});

export default CreateEventScreen;
