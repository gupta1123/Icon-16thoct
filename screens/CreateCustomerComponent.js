import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { format } from 'date-fns';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getPendingCustomers, storePendingCustomer } from '../utils/offlineStorage';
import { getDefaultVisitPurpose, getProductCategoryOptions } from '../utils/clientTypeConfig';
import CustomDropdown from './CustomDropdown';
import DobPicker from './DobPicker';

const clientTypeOptions = [
  { label: 'Engineer/Architect/Contractor', value: 'Engineer/Architect/Contractor' },
  { label: 'Dealer/Shop', value: 'Dealer/Shop' },
  { label: 'Site Visit', value: 'Site Visit' },
];

// Helper functions to check client types (accepting both old and new formats)
const isDealerType = (clientType) => {
  if (!clientType) return false;
  const normalized = clientType.toLowerCase();
  return normalized === 'dealer' || normalized === 'dealer/shop' || normalized.includes('dealer') || normalized.includes('shop');
};

const isProfessionalType = (clientType) => {
  if (!clientType) return false;
  const normalized = clientType.toLowerCase();
  return normalized === 'professional' || 
         normalized === 'engineer/architect/contractor' ||
         normalized.includes('engineer') || 
         normalized.includes('architect') || 
         normalized.includes('contractor') ||
         normalized.includes('professional');
};

const isSiteVisitType = (clientType) => {
  if (!clientType) return false;
  const normalized = clientType.toLowerCase();
  return normalized === 'site visit';
};

const dealerTypeOptions = [
  { label: 'ICON', value: 'ICON' },
  { label: 'NON_ICON', value: 'NON_ICON' },
];

const dealerSubTypeOptions = [
  { label: 'EXCLUSIVE', value: 'EXCLUSIVE' },
  { label: 'NON_EXCLUSIVE', value: 'NON_EXCLUSIVE' },
];

const shopOwnershipOptions = [
  { label: 'Owned', value: 'OWNED' },
  { label: 'Rented', value: 'RENTED' },
];

const projectTypeOptions = [
  { label: 'Home', value: 'HOME' },
  { label: 'Apartment', value: 'APARTMENT' },
  { label: 'Govt Project', value: 'GOVT_PROJECT' },
  { label: 'Commercial Building', value: 'COMMERCIAL' },
  { label: 'Industrial', value: 'INDUSTRIAL' },
  { label: 'Others', value: 'OTHERS' },
];

// Predefined states for customer creation
const predefinedStates = [
  { label: 'Maharashtra', value: 'Maharashtra' },
  { label: 'Madhya Pradesh', value: 'Madhya Pradesh' },
  { label: 'Gujarat', value: 'Gujarat' },
  { label: 'Karnataka', value: 'Karnataka' },
];

const getClientSpecificFieldLabels = (clientType) => {
  if (isSiteVisitType(clientType)) {
    return {
      storeName: 'Project Name',
      clientName: 'Site Owner Name*',
    };
  }

  if (isProfessionalType(clientType)) {
    return {
      storeName: 'Firm Name*',
      clientName: 'Owner Name*',
    };
  }

  if (isDealerType(clientType)) {
    return {
      storeName: 'Shop Name*',
      clientName: 'Owner Name*',
    };
  }

  return {
    storeName: 'Store Name*',
    clientName: 'Client Name*',
  };
};

const stripRequiredMarker = (label) => label.replace('*', '').trim();

const getSiteVisitFallbackName = (details) => {
  const projectName = details.storeName?.trim();
  if (projectName) return projectName;

  const clientName = details.clientName?.trim();
  if (clientName) return clientName;

  return `Site Visit - ${format(new Date(), 'yyyy-MM-dd')}`;
};

const CreateCustomerComponent = ({ isVisible, onClose, authToken, onCustomerCreated, navigation, defaultClientType }) => {
    const [newCustomerDetails, setNewCustomerDetails] = useState({
      storeName: '',
      clientName: '',
      primaryContact: '',
      secondaryContact: '',
      email: '',
      industry: '',
      companySize: '',
      gstNumber: '',
      addressLine1: '',
    
      village: '',
      taluka: '',
      city: '',
      state: '',
      country: '',
      pincode: '',
      latitude: '',
      longitude: '',
      monthlySale: '',
      clientType: '',
      // Dealer/Shop specific fields
      shopAgeYears: '',
      ownershipType: '',
      dealerType: '',
      dealerSubType: '',
      // Engineer/Architect/Contractor specific fields
      firmName: '',
      dateOfBirth: '',
      yearsOfExperience: '',
      // Site Visit specific fields
      contractorName: '',
      engineerName: '',
      contractorId: null,
      engineerId: null,
      area: '',
      projectType: '',
      projectSize: '',
    });
  
    const [selectedClientType, setSelectedClientType] = useState('');
    const [selectedShopOwnership, setSelectedShopOwnership] = useState(null);
    const [selectedIconType, setSelectedIconType] = useState(null);
    const [selectedDealerType, setSelectedDealerType] = useState(null);
    const [selectedDealerSubType, setSelectedDealerSubType] = useState(null);
    const [selectedProjectType, setSelectedProjectType] = useState(null);
    const [selectedEngineer, setSelectedEngineer] = useState(null);
    const [selectedContractor, setSelectedContractor] = useState(null);
    
    // Engineers and Contractors lists
    const [engineersList, setEngineersList] = useState([]);
    const [contractorsList, setContractorsList] = useState([]);
    const [loadingEngineers, setLoadingEngineers] = useState(false);
    const [loadingContractors, setLoadingContractors] = useState(false);
    const [isDobPickerVisible, setIsDobPickerVisible] = useState(false);
    const [errors, setErrors] = useState({});
    const [existingCustomer, setExistingCustomer] = useState(null);
    const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
    const [bottomSheetAnimation] = useState(new Animated.Value(0));
    const [isCreating, setIsCreating] = useState(false);
    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [employeeData, setEmployeeData] = useState(null);

    // Materials of Interest state
    const [selectedMaterials, setSelectedMaterials] = useState([]);
    const [customMaterial, setCustomMaterial] = useState('');
    const [customMaterials, setCustomMaterials] = useState([]);
    const [showAddMaterialInput, setShowAddMaterialInput] = useState(false);

    // Location dropdown data
    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [districtCatalog, setDistrictCatalog] = useState([]);
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
  
    // Nearby stores view state
    const [showNearbyStores, setShowNearbyStores] = useState(true); // Start with nearby stores view
    const [nearbyStores, setNearbyStores] = useState([]);
    const [loadingNearbyStores, setLoadingNearbyStores] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [selectedRadius, setSelectedRadius] = useState(100); // Default 100 meters

    const clientSpecificLabels = getClientSpecificFieldLabels(selectedClientType || newCustomerDetails.clientType);
    const productCategoryOptions = getProductCategoryOptions(selectedClientType || newCustomerDetails.clientType);

    const getFieldLabel = (field) => {
      if (field === 'storeName') {
        return stripRequiredMarker(clientSpecificLabels.storeName);
      }

      if (field === 'clientName') {
        return stripRequiredMarker(clientSpecificLabels.clientName);
      }

      if (field === 'taluka') {
        return 'Taluka / Village';
      }

      return field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1');
    };

    const buildAddressLine = (parts = []) => {
      const uniqueParts = [];

      parts.forEach((part) => {
        const trimmedPart = part?.toString().trim();
        if (!trimmedPart) {
          return;
        }

        if (!uniqueParts.some(existingPart => normalizeLocationToken(existingPart) === normalizeLocationToken(trimmedPart))) {
          uniqueParts.push(trimmedPart);
        }
      });

      return uniqueParts.join(', ');
    };

    const isLikelyPlusCode = (value) => {
      const trimmedValue = value?.toString().trim();
      if (!trimmedValue) {
        return false;
      }

      return /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/i.test(trimmedValue);
    };

    const normalizeLocationToken = (value) => {
      if (!value) {
        return '';
      }

      return value
        .toString()
        .toLowerCase()
        .replace(/\bbangalore\b/g, 'bengaluru')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const locationValuesMatch = (left, right) => {
      const normalizedLeft = normalizeLocationToken(left);
      const normalizedRight = normalizeLocationToken(right);

      if (!normalizedLeft || !normalizedRight) {
        return false;
      }

      return (
        normalizedLeft === normalizedRight ||
        normalizedLeft.includes(normalizedRight) ||
        normalizedRight.includes(normalizedLeft)
      );
    };

    const extractAddressFromCoordinates = (address) => {
      if (!address) {
        return null;
      }

      const addressLine1 = buildAddressLine([
        [address.streetNumber, address.street].filter(Boolean).join(' ').trim(),
        address.name,
      ]);

      const state = address.region?.trim() || '';
      const district = address.subregion?.trim() || address.district?.trim() || '';
      const city = address.city?.trim() || address.district?.trim() || address.subregion?.trim() || '';
      const taluka = address.district?.trim() || address.name?.trim() || city || '';

      return {
        state,
        district,
        city,
        taluka,
        locality: address.name?.trim() || '',
        addressLine1: isLikelyPlusCode(addressLine1) ? '' : addressLine1,
        pincode: address.postalCode?.trim() || '',
        country: address.country?.trim() || '',
      };
    };

    const fetchDistrictFromPincode = async (pincode) => {
      if (!pincode) {
        return '';
      }

      try {
        const response = await axios.get(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'IconMobile/1.0',
          },
          timeout: 15000,
        });

        const lookupResults = Array.isArray(response.data) ? response.data : [];
        const firstResult = lookupResults[0];
        const postOffices = Array.isArray(firstResult?.PostOffice) ? firstResult.PostOffice : [];
        const firstPostOffice = postOffices[0];

        return firstPostOffice?.District?.trim() || '';
      } catch (error) {
        console.error('❌ [LOCATION] Pincode district lookup failed:', error);
        return '';
      }
    };

    const fetchFallbackAddressFromNetwork = async (latitude, longitude) => {
      try {
        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: {
            format: 'jsonv2',
            lat: latitude,
            lon: longitude,
            addressdetails: 1,
          },
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
            'User-Agent': 'IconMobile/1.0',
          },
          timeout: 15000,
        });

        const address = response.data?.address || {};
        const addressLine1 = buildAddressLine([
          [address.house_number, address.road].filter(Boolean).join(' ').trim(),
          address.neighbourhood,
          address.suburb,
          address.hamlet,
          address.village,
        ]);

        return {
          state: address.state?.trim() || '',
          district: (address.state_district || address.county || '').trim(),
          city: (address.city || address.town || address.municipality || address.village || '').trim(),
          taluka: (address.city_district || address.county || address.suburb || address.village || '').trim(),
          locality: (address.suburb || address.neighbourhood || address.village || address.hamlet || '').trim(),
          addressLine1: isLikelyPlusCode(addressLine1) ? '' : addressLine1,
          pincode: address.postcode?.trim() || '',
          country: address.country?.trim() || '',
        };
      } catch (error) {
        console.error('❌ [LOCATION] Network reverse geocode fallback failed:', error);
        return null;
      }
    };

    const inferDistrictFromLocation = (locationFields, availableDistricts = districtCatalog) => {
      const candidates = [
        locationFields?.district,
        locationFields?.city,
        locationFields?.taluka,
        locationFields?.locality,
      ].filter(Boolean);

      if (!candidates.length || !Array.isArray(availableDistricts) || availableDistricts.length === 0) {
        return '';
      }

      for (const district of availableDistricts) {
        const districtName = district?.districtName || '';

        if (candidates.some(candidate => locationValuesMatch(districtName, candidate))) {
          return districtName;
        }

        const districtCities = Array.isArray(district?.cities) ? district.cities : [];
        const cityMatch = districtCities.some(cityInfo =>
          candidates.some(candidate =>
            locationValuesMatch(cityInfo?.cityName, candidate) ||
            locationValuesMatch(cityInfo?.subDistrictName, candidate)
          )
        );

        if (cityMatch) {
          return districtName;
        }
      }

      return locationFields?.district || '';
    };

    const syncLocationDropdownOptions = async ({ state, district }, districtsData = []) => {
      if (state) {
        setStates(prev => {
          const exists = prev.some(option => option.value === state);
          return exists ? prev : [...prev, { label: state, value: state }];
        });
      }

      if (Array.isArray(districtsData) && districtsData.length > 0) {
        const districtsOptions = districtsData.map(item => ({
          label: item.districtName,
          value: item.districtName,
        }));
        setDistricts(districtsOptions);
      }

      if (district) {
        setDistricts(prev => {
          const exists = prev.some(option => option.value === district);
          return exists ? prev : [...prev, { label: district, value: district }];
        });
      }
    };

    const autofillAddressFromCoordinates = async (latitude, longitude) => {
      try {
        const geocodedAddresses = await Location.reverseGeocodeAsync({ latitude, longitude });
        const primaryAddress = Array.isArray(geocodedAddresses) ? geocodedAddresses[0] : null;
        const expoLocationFields = extractAddressFromCoordinates(primaryAddress) || {};
        const networkLocationFields = await fetchFallbackAddressFromNetwork(latitude, longitude);
        const postalDistrict = await fetchDistrictFromPincode(
          networkLocationFields?.pincode || expoLocationFields.pincode || ''
        );
        const preferredExpoAddressLine = !isLikelyPlusCode(expoLocationFields.addressLine1)
          ? expoLocationFields.addressLine1
          : '';
        const locationFields = {
          state: networkLocationFields?.state || expoLocationFields.state || '',
          district: postalDistrict || networkLocationFields?.district || expoLocationFields.district || '',
          city: expoLocationFields.city || networkLocationFields?.city || '',
          taluka: expoLocationFields.taluka || networkLocationFields?.taluka || '',
          locality: expoLocationFields.locality || networkLocationFields?.locality || '',
          addressLine1: preferredExpoAddressLine || networkLocationFields?.addressLine1 || '',
          pincode: networkLocationFields?.pincode || expoLocationFields.pincode || '',
          country: networkLocationFields?.country || expoLocationFields.country || 'India',
        };

        if (!locationFields.state && !locationFields.city && !locationFields.taluka && !locationFields.district) {
          return;
        }

        const districtsData = locationFields.state
          ? await fetchDistricts(locationFields.state)
          : districtCatalog;
        const inferredDistrict = inferDistrictFromLocation(locationFields, districtsData);
        const resolvedLocationFields = {
          ...locationFields,
          district: inferredDistrict || locationFields.district,
        };

        setNewCustomerDetails(prev => ({
          ...prev,
          state: resolvedLocationFields.state || prev.state,
          district: resolvedLocationFields.district || prev.district,
          taluka: resolvedLocationFields.taluka || prev.taluka,
          city: resolvedLocationFields.city || prev.city,
          addressLine1: resolvedLocationFields.addressLine1 || prev.addressLine1,
          pincode: resolvedLocationFields.pincode || prev.pincode,
          country: resolvedLocationFields.country || prev.country || 'India',
        }));

        await syncLocationDropdownOptions(resolvedLocationFields, districtsData);
      } catch (error) {
        console.error('❌ [LOCATION] Error reverse geocoding coordinates:', error);
      }
    };
  
    useEffect(() => {
      if (isVisible) {
        fetchEmployeeData();
        resetForm();
        // Set predefined states instead of fetching from API
        setStates(predefinedStates);
        // Reset to show nearby stores view when modal opens
        setShowNearbyStores(true);
        setNearbyStores([]);
        setCurrentLocation(null);
        setLocationError(null);
        setSelectedRadius(100); // Reset to default radius
        // Fetch current location and nearby stores
        fetchLocationAndNearbyStores();
        
        // Set default client type if provided (map old values to new format)
        if (defaultClientType) {
          // Map old backend values to new display format
          const clientTypeMapping = {
            'Professional': 'Engineer/Architect/Contractor',
            'Dealer': 'Dealer/Shop',
            'Site Visit': 'Site Visit',
          };
          const mappedClientType = clientTypeMapping[defaultClientType] || defaultClientType;
          const clientTypeOption = clientTypeOptions.find(opt => opt.value === mappedClientType);
          if (clientTypeOption) {
            setSelectedClientType(mappedClientType);
            setNewCustomerDetails(prev => ({ ...prev, clientType: mappedClientType }));
          }
        }
      }
    }, [isVisible, defaultClientType]);

    // Fetch districts when state changes
    useEffect(() => {
      if (newCustomerDetails.state) {
        fetchDistricts(newCustomerDetails.state);
      } else {
        setDistricts([]);
        setDistrictCatalog([]);
      }
    }, [newCustomerDetails.state]);

    // Fetch engineers and contractors when Site Visit is selected
    useEffect(() => {
      if (selectedClientType === 'Site Visit' && isVisible) {
        fetchEngineers();
        fetchContractors();
      }
    }, [selectedClientType, isVisible]);

    useEffect(() => {
      setSelectedMaterials([]);
      setCustomMaterial('');
      setCustomMaterials([]);
      setShowAddMaterialInput(false);
    }, [selectedClientType]);

    const fetchEmployeeData = async () => {
      try {
        console.log('🔵 [CREATE CUSTOMER] Fetching employee data from /employee/me...');
        const response = await axios.get('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/employee/me', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        
        console.log('🔵 [CREATE CUSTOMER] Employee data received:', response.data);
        setEmployeeData(response.data);
        
        // Pre-fill country if available
        setNewCustomerDetails(prev => ({
          ...prev,
          country: prev.country || response.data.country || 'India',
        }));

        await fetchAssignedCities();
      } catch (error) {
        console.error('❌ [CREATE CUSTOMER] Error fetching employee data:', error);
        await fetchAssignedCities(); // still attempt to load assigned cities
      }
    };

    const fetchAssignedCities = async () => {
      try {
        const response = await axios.get('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/employee/getMyAssignedCities', {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'IconMobile',
          },
        });

        const assignedCities = Array.isArray(response.data) ? response.data : [];
        console.log('🏙️ [CREATE CUSTOMER] Assigned cities response:', assignedCities);

        if (assignedCities.length > 0) {
          const primaryCity = assignedCities[0];

          setNewCustomerDetails(prev => ({
            ...prev,
            state: prev.state || primaryCity.stateName || '',
            district: prev.district || primaryCity.districtName || '',
            taluka: prev.taluka || primaryCity.subDistrictName || '',
          }));

          if (primaryCity.stateName) {
            setStates(prev => {
              const exists = prev.some(option => option.value === primaryCity.stateName);
              return exists
                ? prev
                : [
                    ...prev,
                    { label: primaryCity.stateName, value: primaryCity.stateName },
                  ];
            });
            if (primaryCity.districtName) {
              setDistricts(prev => {
                const exists = prev.some(option => option.value === primaryCity.districtName);
                return exists
                  ? prev
                  : [
                      ...prev,
                      { label: primaryCity.districtName, value: primaryCity.districtName },
                    ];
              });
            }
          }
        }
      } catch (error) {
        console.error('❌ [CREATE CUSTOMER] Error fetching assigned cities:', error);
      }
    };
  
    // Location data fetching functions
    const fetchStates = async () => {
      try {
        setLoadingStates(true);
        console.log('🌍 [LOCATION] Fetching states...');
        
        if (!authToken) {
          console.error('❌ [LOCATION] No auth token available');
          setStates([]);
          return;
        }

        const response = await axios.get('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/location/states', {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'IconMobile',
          },
        });
        
        console.log('🌍 [LOCATION] States response:', response.data);
        const statesData = Array.isArray(response.data) ? response.data : [];
        const statesOptions = statesData.map(state => ({ label: state.stateName, value: state.stateName }));
        setStates(statesOptions);
        console.log('✅ [LOCATION] Loaded', statesOptions.length, 'states');
      } catch (error) {
        console.error('❌ [LOCATION] Error fetching states:', error);
        console.error('❌ [LOCATION] Error response:', error.response?.data);
        setStates([]);
      } finally {
        setLoadingStates(false);
      }
    };

    const fetchDistricts = async (selectedState) => {
      if (!selectedState) {
        setDistricts([]);
        setDistrictCatalog([]);
        return [];
      }
      try {
        setLoadingDistricts(true);
        console.log('🌍 [LOCATION] Fetching districts for state:', selectedState);
        
        const response = await axios.get(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/location/districts?stateName=${encodeURIComponent(selectedState)}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'IconMobile',
          },
        });
        
        console.log('🌍 [LOCATION] Districts response:', response.data);
        const districtsData = Array.isArray(response.data) ? response.data : [];
        setDistrictCatalog(districtsData);
        const districtsOptions = districtsData.map(district => ({ label: district.districtName, value: district.districtName }));
        setDistricts(districtsOptions);
        console.log('✅ [LOCATION] Loaded', districtsOptions.length, 'districts for', selectedState);
        return districtsData;
      } catch (error) {
        console.error('❌ [LOCATION] Error fetching districts:', error);
        console.error('❌ [LOCATION] Error response:', error.response?.data);
        console.error('❌ [LOCATION] State parameter was:', selectedState);
        setDistricts([]);
        setDistrictCatalog([]);
        return [];
      } finally {
        setLoadingDistricts(false);
      }
    };

    // Fetch engineers list
    const fetchEngineers = async () => {
      try {
        setLoadingEngineers(true);
        console.log('👷 [ENGINEERS] Fetching engineers list...');
        
        const response = await axios.get('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/professionals/getAll', {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'IconMobile',
          },
        });
        
        console.log('✅ [ENGINEERS] Engineers response:', response.data);
        const professionals = Array.isArray(response.data) ? response.data : [];
        // Filter engineers (role can be 'Engineer', 'Architect', or similar)
        const engineers = professionals.filter(p => 
          p.role && (p.role.toLowerCase().includes('engineer') || p.role.toLowerCase().includes('architect'))
        );
        setEngineersList(engineers);
        console.log('✅ [ENGINEERS] Loaded', engineers.length, 'engineers');
      } catch (error) {
        console.error('❌ [ENGINEERS] Error fetching engineers:', error);
        setEngineersList([]);
      } finally {
        setLoadingEngineers(false);
      }
    };

    // Fetch contractors list
    const fetchContractors = async () => {
      try {
        setLoadingContractors(true);
        console.log('🏗️ [CONTRACTORS] Fetching contractors list...');
        
        const response = await axios.get('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/professionals/getAll', {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'IconMobile',
          },
        });
        
        console.log('✅ [CONTRACTORS] Contractors response:', response.data);
        const professionals = Array.isArray(response.data) ? response.data : [];
        // Filter contractors
        const contractors = professionals.filter(p => 
          p.role && p.role.toLowerCase().includes('contractor')
        );
        setContractorsList(contractors);
        console.log('✅ [CONTRACTORS] Loaded', contractors.length, 'contractors');
      } catch (error) {
        console.error('❌ [CONTRACTORS] Error fetching contractors:', error);
        setContractorsList([]);
      } finally {
        setLoadingContractors(false);
      }
    };

  const resetForm = () => {
    setNewCustomerDetails({
      storeName: '',
      clientName: '',
      primaryContact: '',
      secondaryContact: '',
      email: '',
      industry: '',
      companySize: '',
      gstNumber: '',
      addressLine1: '',
  
      village: '',
      taluka: '',
      city: '',
      district: '',
      state: '',
      country: employeeData?.country || '',
      pincode: '',
      latitude: '',
      longitude: '',
      monthlySale: '',
      clientType: '',
      shopAgeYears: '',
      ownershipType: '',
      dealerType: '',
      dealerSubType: '',
      firmName: '',
      dateOfBirth: '',
      yearsOfExperience: '',
      contractorName: '',
      engineerName: '',
      contractorId: null,
      engineerId: null,
      area: '',
      projectType: '',
      projectSize: '',
    });
      setSelectedClientType('');
      setSelectedShopOwnership(null);
      setSelectedIconType(null);
      setSelectedDealerType(null);
      setSelectedDealerSubType(null);
      setSelectedProjectType(null);
      setSelectedEngineer(null);
      setSelectedContractor(null);
      setErrors({});
      setExistingCustomer(null);
      setIsBottomSheetVisible(false);

      // Reset materials of interest
      setSelectedMaterials([]);
      setCustomMaterial('');
      setCustomMaterials([]);
      setShowAddMaterialInput(false);

      // Reset location dropdown data
      setDistricts([]);
      setDistrictCatalog([]);
    };
  
    const handleClose = () => {
      resetForm();
      setShowNearbyStores(true);
      setNearbyStores([]);
      setCurrentLocation(null);
      setLocationError(null);
      onClose();
    };

    const handleCreateStoreClick = () => {
      setShowNearbyStores(false);
    };

    const handleStoreItemClick = (store) => {
      handleClose();
      navigation.navigate('CustomerDetails', { customerId: store.storeId, authToken, openVisitModal: true });
    };

    const handleRadiusChange = async (radius) => {
      setSelectedRadius(radius);
      if (currentLocation) {
        await fetchNearbyStores(currentLocation.latitude, currentLocation.longitude, radius);
      }
    };

    const handleCreateStoreAndVisit = async () => {
      // First validate the form
      const newErrors = {};

      // Required fields for all client types
      const requiredFields = ['clientName', 'state', 'district', 'taluka', 'city', 'clientType'];
      if (!isSiteVisitType(newCustomerDetails.clientType)) {
        requiredFields.unshift('storeName');
      }
      
      requiredFields.forEach(field => {
        if (!newCustomerDetails[field]) {
          newErrors[field] = `${getFieldLabel(field)} is required`;
        }
      });
  
      // Validate phone number only if provided (optional field)
      if (newCustomerDetails.primaryContact && !/^\d{10}$/.test(newCustomerDetails.primaryContact)) {
        newErrors.primaryContact = 'Invalid phone number (must be 10 digits)';
      }
  
      // GPS coordinates are required for all customer types
      if (!newCustomerDetails.latitude || !newCustomerDetails.longitude) {
        newErrors.gpsLocation = 'GPS coordinates are required';
      }

      // Additional validation for Engineer/Architect/Contractor
      if (isProfessionalType(newCustomerDetails.clientType)) {
        if (!newCustomerDetails.dateOfBirth) {
          newErrors.dateOfBirth = 'Date of birth is required';
        }
        if (!newCustomerDetails.yearsOfExperience) {
          newErrors.yearsOfExperience = 'Years of experience is required';
        }
      }

      // Additional validation for Dealer/Shop
      if (isDealerType(newCustomerDetails.clientType)) {
        if (!newCustomerDetails.shopAgeYears) {
          newErrors.shopAgeYears = 'Shop age is required for Dealer/Shop';
        }
        if (!newCustomerDetails.ownershipType) {
          newErrors.ownershipType = 'Shop ownership type is required';
        }
        if (!newCustomerDetails.dealerType) {
          newErrors.dealerType = 'Dealer type is required';
        }
        if (newCustomerDetails.dealerType === 'ICON' && !newCustomerDetails.dealerSubType) {
          newErrors.dealerSubType = 'Dealer sub-type is required';
        }
      }
  
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        Alert.alert('Validation Error', 'Please fill in all required fields');
        return;
      }
  
      setIsCreating(true);
      try {
        // Check if customer already exists (only if phone number is provided)
        if (newCustomerDetails.primaryContact) {
          try {
            const response = await axios.get(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/getByPhone?phone=${newCustomerDetails.primaryContact}`, {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            });
    
            if (response.data && response.data.storeId) {
              setExistingCustomer(response.data);
              showBottomSheet();
              setIsCreating(false);
              return;
            }
          } catch (error) {
            // If error is not network error, proceed with creation
            if (error.response && error.response.status !== 406) {
              console.error('Error checking existing customer:', error);
              setIsCreating(false);
              return;
            }
          }
        }

        // Create store first
        const newCustomerId = await createNewCustomerForVisit();
        
        if (!newCustomerId) {
          setIsCreating(false);
          return;
        }

        // Then create visit
        const employeeId = await AsyncStorage.getItem('employeeId');
        const today = format(new Date(), 'yyyy-MM-dd');
        
        // Match the payload format used in CustomerDetails.js
        const visitPayload = {
          storeId: newCustomerId,
          employeeId: employeeId, // Keep as string to match other implementations
          visit_date: today,
          purpose: getDefaultVisitPurpose(newCustomerDetails.clientType),
        };
        
        console.log('🔵 [VISIT] Creating visit with payload:', JSON.stringify(visitPayload, null, 2));
        console.log('🔵 [VISIT] Store ID:', newCustomerId, 'Type:', typeof newCustomerId);
        console.log('🔵 [VISIT] Employee ID:', employeeId, 'Type:', typeof employeeId);
        console.log('🔵 [VISIT] Visit date:', today);
        console.log('🔵 [VISIT] Purpose:', visitPayload.purpose);
        
        try {
          const visitResponse = await axios.put(
            'https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/visit/create',
            visitPayload,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                'User-Agent': 'IconMobile',
              },
            }
          );

          console.log('🔵 [VISIT] Visit response:', visitResponse);
          console.log('🔵 [VISIT] Visit response data:', visitResponse.data);
          console.log('🔵 [VISIT] Visit response status:', visitResponse.status);

          // Handle different response formats
          let visitId;
          if (typeof visitResponse.data === 'number') {
            visitId = visitResponse.data;
          } else if (typeof visitResponse.data === 'string') {
            visitId = parseInt(visitResponse.data);
          } else if (visitResponse.data?.id || visitResponse.data?.visitId) {
            visitId = visitResponse.data.id || visitResponse.data.visitId;
          } else {
            visitId = visitResponse.data;
          }
          
          if (!visitId || visitId === 'null' || visitId === 'undefined') {
            console.error('❌ [VISIT] Invalid visit ID returned:', visitResponse.data);
            throw new Error('Visit ID not returned from server');
          }
          
          console.log('✅ [VISIT] Visit created with ID:', visitId);
          console.log('✅ [VISIT] Visit ID type:', typeof visitId);

          Alert.alert("Success", "Store and visit created successfully!");
          handleClose();
          onCustomerCreated();
          
          // Navigate to VisitScreen
          navigation.navigate('VisitScreen', { visitId, authToken });
        } catch (visitError) {
          console.error('Error creating visit:', visitError);
          console.error('Visit error response:', visitError.response?.data);
          
          // Extract error message - could be string or object
          let errorMessage = '';
          if (visitError.response?.data) {
            if (typeof visitError.response.data === 'string') {
              errorMessage = visitError.response.data;
            } else if (visitError.response.data.message) {
              errorMessage = visitError.response.data.message;
            } else if (visitError.response.data.error) {
              errorMessage = visitError.response.data.error;
            }
          }

          // Store is created successfully, but visit can't be created
          Alert.alert(
            'Store Created Successfully',
            errorMessage
              ? `Store has been created successfully. However, the visit could not be created: ${errorMessage}`
              : 'Store has been created successfully. However, the visit could not be created. You can create it later from the store details page.',
            [
              { 
                text: 'OK', 
                onPress: () => {
                  handleClose();
                  onCustomerCreated();
                  navigation.navigate('CustomerDetails', { customerId: newCustomerId, authToken });
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('Error creating store and visit:', error);
        console.error('Error response:', error.response?.data);
        Alert.alert('Error', error.response?.data?.message || 'An error occurred while creating the store and visit. Please try again.');
      } finally {
        setIsCreating(false);
      }
    };

    // Helper function to split client name into first and last name
    const splitClientName = (fullName) => {
      if (!fullName || !fullName.trim()) {
        return { firstName: '', lastName: '' };
      }
      const trimmedName = fullName.trim();
      const nameParts = trimmedName.split(/\s+/);
      if (nameParts.length === 1) {
        return { firstName: trimmedName, lastName: '' };
      }
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      return { firstName, lastName };
    };

    const createNewCustomerForVisit = async () => {
      try {
        const employeeId = await AsyncStorage.getItem('employeeId');
        const { firstName, lastName } = splitClientName(newCustomerDetails.clientName);
        
        // Prepare the payload according to API structure
        const payload = {
          storeName: isSiteVisitType(newCustomerDetails.clientType)
            ? getSiteVisitFallbackName(newCustomerDetails)
            : newCustomerDetails.storeName,
          clientFirstName: firstName,
          clientLastName: lastName,
          primaryContact: newCustomerDetails.primaryContact ? parseInt(newCustomerDetails.primaryContact) : null,
          secondaryContact: newCustomerDetails.secondaryContact || null,
          email: newCustomerDetails.email || null,
          industry: newCustomerDetails.industry || null,
          companySize: newCustomerDetails.companySize ? parseInt(newCustomerDetails.companySize) : null,
          gstNumber: newCustomerDetails.gstNumber || null,
          addressLine1: newCustomerDetails.addressLine1 || null,
          
          city: newCustomerDetails.city || null,
          district: newCustomerDetails.district || null,
          subDistrict: newCustomerDetails.taluka || null,
          state: newCustomerDetails.state,
          country: newCustomerDetails.country,
          pincode: newCustomerDetails.pincode ? parseInt(newCustomerDetails.pincode) : null,
          latitude: newCustomerDetails.latitude ? parseFloat(newCustomerDetails.latitude) : null,
          longitude: newCustomerDetails.longitude ? parseFloat(newCustomerDetails.longitude) : null,
          monthlySale: newCustomerDetails.monthlySale ? parseFloat(newCustomerDetails.monthlySale) : null,
          clientType: newCustomerDetails.clientType,
          employeeId: parseInt(employeeId),
          brandProCons: [],
          productCategories:
            selectedMaterials.length > 0
              ? Array.from(new Set(selectedMaterials.map(c => c?.toString().toLowerCase())))
              : null,
        };
        
        // Add Dealer/Shop specific fields
        if (isDealerType(newCustomerDetails.clientType)) {
          if (newCustomerDetails.shopAgeYears) {
            payload.shopAgeYears = parseInt(newCustomerDetails.shopAgeYears);
          }
          if (newCustomerDetails.ownershipType) {
            payload.ownershipType = newCustomerDetails.ownershipType;
          }
          if (newCustomerDetails.dealerType) {
            payload.dealerType = newCustomerDetails.dealerType;
          }
          if (newCustomerDetails.dealerType === 'ICON' && newCustomerDetails.dealerSubType) {
            payload.dealerSubType = newCustomerDetails.dealerSubType;
          }
        }

        // Add Site Visit specific fields
        if (isSiteVisitType(newCustomerDetails.clientType)) {
          if (newCustomerDetails.contractorName) {
            payload.contractorName = newCustomerDetails.contractorName;
          }
          if (newCustomerDetails.contractorId) {
            payload.contractorId = newCustomerDetails.contractorId;
          }
          if (newCustomerDetails.engineerName) {
            payload.engineerName = newCustomerDetails.engineerName;
          }
          if (newCustomerDetails.engineerId) {
            payload.engineerId = newCustomerDetails.engineerId;
          }
          if (newCustomerDetails.area) {
            payload.area = newCustomerDetails.area;
          }
          if (newCustomerDetails.projectType) {
            payload.projectType = newCustomerDetails.projectType;
          }
          if (newCustomerDetails.projectSize) {
            payload.projectSizeSquareFeet = parseFloat(newCustomerDetails.projectSize);
          }
        }

        console.log('Creating customer with payload:', payload);

        const createResponse = await axios.post('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/create', payload, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        const newCustomerId = createResponse.data;
        console.log('✅ [CUSTOMER] Store created with ID:', newCustomerId);

        // For Professional customers, create professional record
        if (isProfessionalType(newCustomerDetails.clientType)) {
          try {
            const professionalPayload = {
              name: newCustomerDetails.clientName.trim(),
              contact: newCustomerDetails.primaryContact || null,
              role: 'Professional',
              email: newCustomerDetails.email || null,
              experience: newCustomerDetails.yearsOfExperience ? `${newCustomerDetails.yearsOfExperience} years` : null,
              storeId: newCustomerId,
            };

            await axios.post('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/professionals/addForStore', professionalPayload, {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            });

            console.log('✅ [PROFESSIONAL] Professional record created successfully');
          } catch (professionalError) {
            console.error('⚠️ [PROFESSIONAL] Error creating professional record:', professionalError);
            // Don't fail the whole operation if professional record creation fails
          }
        }

        return newCustomerId;
      } catch (error) {
        console.error('Error creating customer:', error);
        console.error('Error response:', error.response?.data);
        throw error;
      }
    };
  
    const handleInputChange = (name, value) => {
      setNewCustomerDetails(prev => {
        if (name === 'dealerType') {
          return {
            ...prev,
            dealerType: value,
            dealerSubType: value === 'NON_ICON' ? '' : prev.dealerSubType,
          };
        }
        if (name === 'state') {
          return {
            ...prev,
            state: value,
            district: '',
            taluka: '',
            city: '',
          };
        }
        if (name === 'district') {
          return {
            ...prev,
            district: value,
            taluka: '',
          };
        }
        return { ...prev, [name]: value };
      });
      if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
      if (name === 'dealerType' && value === 'NON_ICON' && errors.dealerSubType) {
        setErrors(prev => ({ ...prev, dealerSubType: '' }));
      }
    };

    const handleDobSelect = (date) => {
      const formattedDate = format(date, 'yyyy-MM-dd');
      setNewCustomerDetails(prev => ({ ...prev, dateOfBirth: formattedDate }));
      setIsDobPickerVisible(false);
      if (errors.dateOfBirth) {
        setErrors(prev => ({ ...prev, dateOfBirth: '' }));
      }
    };

    const handleMaterialToggle = (material) => {
      setSelectedMaterials(prev => {
        if (prev.includes(material)) {
          return prev.filter(m => m !== material);
        } else {
          return [...prev, material];
        }
      });
    };

    const handleAddCustomMaterial = () => {
      if (customMaterial.trim()) {
        const trimmedMaterial = customMaterial.trim();
        // Check if it's not already in predefined or custom materials
        if (!productCategoryOptions.find(m => m.value.toLowerCase() === trimmedMaterial.toLowerCase()) &&
            !customMaterials.find(m => m.toLowerCase() === trimmedMaterial.toLowerCase())) {
          setCustomMaterials(prev => [...prev, trimmedMaterial]);
          setSelectedMaterials(prev => [...prev, trimmedMaterial]);
          setCustomMaterial('');
        } else {
          Alert.alert('Duplicate', 'This material is already added');
        }
      }
    };

    const handleRemoveCustomMaterial = (material) => {
      setCustomMaterials(prev => prev.filter(m => m !== material));
      setSelectedMaterials(prev => prev.filter(m => m !== material));
    };

    const fetchLocationAndNearbyStores = async () => {
      try {
        setLoadingNearbyStores(true);
        setLocationError(null);
        
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission is required to find nearby stores');
          setLoadingNearbyStores(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        
        setCurrentLocation(locationData);
        
        // Also update the form with location
        setNewCustomerDetails(prev => ({
          ...prev,
          latitude: locationData.latitude.toString(),
          longitude: locationData.longitude.toString(),
        }));

        await autofillAddressFromCoordinates(locationData.latitude, locationData.longitude);

        // Fetch nearby stores with default radius
        await fetchNearbyStores(locationData.latitude, locationData.longitude, selectedRadius);
      } catch (error) {
        console.error('Error fetching location:', error);
        setLocationError('Failed to fetch location. Please try again.');
        setLoadingNearbyStores(false);
      }
    };

    const fetchNearbyStores = async (latitude, longitude, radiusInMeters = 100) => {
      try {
        setLoadingNearbyStores(true);
        console.log('🔍 [NEARBY STORES] Fetching stores near:', latitude, longitude);
        
        const response = await axios.get(
          `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/getByLocation?latitude=${latitude}&longitude=${longitude}&radiusInMeters=${radiusInMeters}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'ngrok-skip-browser-warning': 'true',
              'User-Agent': 'IconMobile',
            },
          }
        );

        console.log('✅ [NEARBY STORES] Response:', response.data);
        const stores = Array.isArray(response.data) ? response.data : [];
        setNearbyStores(stores);
        console.log('✅ [NEARBY STORES] Found', stores.length, 'stores nearby');
      } catch (error) {
        console.error('❌ [NEARBY STORES] Error fetching nearby stores:', error);
        console.error('❌ [NEARBY STORES] Error response:', error.response?.data);
        setNearbyStores([]);
        if (error.response?.status !== 404) {
          Alert.alert('Error', 'Failed to fetch nearby stores. Please try again.');
        }
      } finally {
        setLoadingNearbyStores(false);
      }
    };

    const fetchCurrentLocation = async () => {
      try {
        setFetchingLocation(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to capture GPS coordinates');
          setFetchingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setNewCustomerDetails(prev => ({
          ...prev,
          latitude: location.coords.latitude.toString(),
          longitude: location.coords.longitude.toString(),
        }));

        await autofillAddressFromCoordinates(location.coords.latitude, location.coords.longitude);
        
        if (errors.gpsLocation) {
          setErrors(prev => ({ ...prev, gpsLocation: '' }));
        }
        
        Alert.alert('Success', 'GPS coordinates captured and location fields updated successfully!');
      } catch (error) {
        console.error('Error fetching location:', error);
        Alert.alert('Error', 'Failed to fetch GPS coordinates. Please try again.');
      } finally {
        setFetchingLocation(false);
      }
    };
  
    const handleCreateCustomer = async () => {
      const newErrors = {};

      // Required fields for all client types
      const requiredFields = ['clientName', 'state', 'district', 'taluka', 'city', 'clientType'];
      if (!isSiteVisitType(newCustomerDetails.clientType)) {
        requiredFields.unshift('storeName');
      }
      
      requiredFields.forEach(field => {
        if (!newCustomerDetails[field]) {
          newErrors[field] = `${getFieldLabel(field)} is required`;
        }
      });
  
      // Validate phone number only if provided (optional field)
      if (newCustomerDetails.primaryContact && !/^\d{10}$/.test(newCustomerDetails.primaryContact)) {
        newErrors.primaryContact = 'Invalid phone number (must be 10 digits)';
      }
  
      // GPS coordinates are required for all customer types
      if (!newCustomerDetails.latitude || !newCustomerDetails.longitude) {
        newErrors.gpsLocation = 'GPS coordinates are required';
      }

      // Additional validation for Engineer/Architect/Contractor
      if (isProfessionalType(newCustomerDetails.clientType)) {
        if (!newCustomerDetails.dateOfBirth) {
          newErrors.dateOfBirth = 'Date of birth is required';
        }
        if (!newCustomerDetails.yearsOfExperience) {
          newErrors.yearsOfExperience = 'Years of experience is required';
        }
      }

      // Additional validation for Dealer/Shop
      if (isDealerType(newCustomerDetails.clientType)) {
        if (!newCustomerDetails.shopAgeYears) {
          newErrors.shopAgeYears = 'Shop age is required for Dealer/Shop';
        }
        if (!newCustomerDetails.ownershipType) {
          newErrors.ownershipType = 'Shop ownership type is required';
        }
        if (!newCustomerDetails.dealerType) {
          newErrors.dealerType = 'Dealer type is required';
        }
        if (newCustomerDetails.dealerType === 'ICON' && !newCustomerDetails.dealerSubType) {
          newErrors.dealerSubType = 'Dealer sub-type is required';
        }
      }

      // Additional validation for Site Visit (now optional - can be added later)
      // Site details are no longer required during customer creation
      // They can be added via a separate API call or skipped entirely
      if (newCustomerDetails.clientType === 'Site Visit') {
        // Site Owner, Project Type, and Project Size are now optional
        // No validation errors will be thrown if they're missing
        // If provided, they will be sent in a separate API call after store creation
      }
  
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        Alert.alert('Validation Error', 'Please fill in all required fields');
        return;
      }
  
      setIsCreating(true);
      try {
        // Check if customer already exists (only if phone number is provided)
        if (newCustomerDetails.primaryContact) {
          try {
            const response = await axios.get(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/getByPhone?phone=${newCustomerDetails.primaryContact}`, {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            });
    
            if (response.data && response.data.storeId) {
              setExistingCustomer(response.data);
              showBottomSheet();
              setIsCreating(false);
              return;
            }
          } catch (error) {
            // If error is not network error, proceed with creation
            if (error.response && error.response.status !== 406) {
              console.error('Error checking existing customer:', error);
              setIsCreating(false);
              return;
            }
          }
        }
        
        // Proceed with creating new customer
        await createNewCustomer();
      } catch (error) {
        console.error('Error creating customer:', error);
        // Handle network errors by storing locally
        if (!error.response || error.message === 'Network Error') {
          await handleOfflineStorage();
        } else {
          Alert.alert('Error', error.response?.data || 'An error occurred while creating the customer. Please try again.');
        }
      } finally {
        setIsCreating(false);
      }
    };
  
    const handleOfflineStorage = async () => {
      const stored = await storePendingCustomer(newCustomerDetails);
      if (stored) {
        Alert.alert(
          'Network Error',
          'Customer details have been saved locally. They will be created when internet connection is available.',
          [{ text: 'OK', onPress: () => {
            handleClose();
            onCustomerCreated();
          }}]
        );
      } else {
        // Check pending customers to see if it failed due to duplicate (only if phone number is provided)
        let isDuplicate = false;
        if (newCustomerDetails.primaryContact) {
          const pendingCustomers = await getPendingCustomers();
          isDuplicate = pendingCustomers.some(
            customer => customer.primaryContact === newCustomerDetails.primaryContact
          );
        }

        if (isDuplicate) {
          Alert.alert(
            'Duplicate Customer',
            'A customer with this phone number is already pending for creation. Please check the pending requests list.'
          );
        } else {
          Alert.alert('Error', 'Failed to save customer details locally');
        }
      }
    };
  
  const createNewCustomer = async () => {
    try {
      const employeeId = await AsyncStorage.getItem('employeeId');
      const { firstName, lastName } = splitClientName(newCustomerDetails.clientName);
      
      // Prepare the payload according to API structure
      const payload = {
        storeName: isSiteVisitType(newCustomerDetails.clientType)
          ? getSiteVisitFallbackName(newCustomerDetails)
          : newCustomerDetails.storeName,
        clientFirstName: firstName,
        clientLastName: lastName,
        primaryContact: newCustomerDetails.primaryContact ? parseInt(newCustomerDetails.primaryContact) : null,
        secondaryContact: newCustomerDetails.secondaryContact || null,
        email: newCustomerDetails.email || null,
        industry: newCustomerDetails.industry || null,
        companySize: newCustomerDetails.companySize ? parseInt(newCustomerDetails.companySize) : null,
        gstNumber: newCustomerDetails.gstNumber || null,
        addressLine1: newCustomerDetails.addressLine1 || null,
        
        city: newCustomerDetails.city || null,
        district: newCustomerDetails.district || null,
        subDistrict: newCustomerDetails.taluka || null,
        state: newCustomerDetails.state,
        country: newCustomerDetails.country,
        pincode: newCustomerDetails.pincode ? parseInt(newCustomerDetails.pincode) : null,
        latitude: newCustomerDetails.latitude ? parseFloat(newCustomerDetails.latitude) : null,
        longitude: newCustomerDetails.longitude ? parseFloat(newCustomerDetails.longitude) : null,
        monthlySale: newCustomerDetails.monthlySale ? parseFloat(newCustomerDetails.monthlySale) : null,
        clientType: newCustomerDetails.clientType,
        employeeId: parseInt(employeeId),
        brandProCons: [], // Empty array for now, can be added later
        productCategories:
          selectedMaterials.length > 0
            ? Array.from(new Set(selectedMaterials.map(c => c?.toString().toLowerCase())))
            : null,
      };
      
      // Add Dealer/Shop specific fields
      if (isDealerType(newCustomerDetails.clientType)) {
        if (newCustomerDetails.shopAgeYears) {
          payload.shopAgeYears = parseInt(newCustomerDetails.shopAgeYears);
        }
        if (newCustomerDetails.ownershipType) {
          payload.ownershipType = newCustomerDetails.ownershipType;
        }
        if (newCustomerDetails.dealerType) {
          payload.dealerType = newCustomerDetails.dealerType;
        }
        if (newCustomerDetails.dealerType === 'ICON' && newCustomerDetails.dealerSubType) {
          payload.dealerSubType = newCustomerDetails.dealerSubType;
        }
      }

      // Add Site Visit specific fields directly to store creation payload
      if (newCustomerDetails.clientType === 'Site Visit') {
        // Add contractor name (text)
        if (newCustomerDetails.contractorName) {
          payload.contractorName = newCustomerDetails.contractorName;
        }
        
        // Add engineer name (text)
        if (newCustomerDetails.engineerName) {
          payload.engineerName = newCustomerDetails.engineerName;
        }
        
        // Add project details
        if (newCustomerDetails.projectType) {
          payload.projectType = newCustomerDetails.projectType;
        }
        
        if (newCustomerDetails.projectSize) {
          payload.projectSizeSquareFeet = parseFloat(newCustomerDetails.projectSize);
        }
      }

      console.log('Creating customer with payload:', payload);

      // Step 1: Create Store
      const createResponse = await axios.post('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/create', payload, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const newCustomerId = createResponse.data;
      console.log('✅ [CUSTOMER] Store created with ID:', newCustomerId);

      // Step 2: For Professional customers, create professional record
      if (isProfessionalType(newCustomerDetails.clientType)) {
        try {
          const professionalPayload = {
            name: newCustomerDetails.clientName.trim(),
            contact: newCustomerDetails.primaryContact || null,
            role: 'Professional', // or determine from sub-type if needed
            email: newCustomerDetails.email || null,
            experience: newCustomerDetails.yearsOfExperience ? `${newCustomerDetails.yearsOfExperience} years` : null,
            storeId: newCustomerId,
          };

          console.log('🔵 [PROFESSIONAL] Creating professional record with payload:', professionalPayload);

          await axios.post('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/professionals/addForStore', professionalPayload, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });

          console.log('✅ [PROFESSIONAL] Professional record created successfully');
        } catch (professionalError) {
          console.error('⚠️ [PROFESSIONAL] Error creating professional record:', professionalError);
          // Don't fail the whole operation if professional record creation fails
          // The store is already created
        }
      }

      // Site Visit fields are now included directly in the store/create payload
      // No separate API call needed

      Alert.alert("Success", "Customer created successfully!");
      handleClose();
      onCustomerCreated();
      navigation.navigate('CustomerDetails', { customerId: newCustomerId, authToken });
    } catch (error) {
      console.error('Error creating customer:', error);
      console.error('Error response:', error.response?.data);
      if (!error.response || error.message === 'Network Error') {
        await handleOfflineStorage();
      } else {
        Alert.alert('Error', error.response?.data || 'An error occurred while creating the customer. Please try again.');
      }
    }
  };
  
    const showBottomSheet = () => {
      setIsBottomSheetVisible(true);
      Animated.timing(bottomSheetAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };
  
    const hideBottomSheet = () => {
      Animated.timing(bottomSheetAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setIsBottomSheetVisible(false));
    };
  
    const renderInput = (name, label, keyboardType = 'default') => (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.input, errors[name] && styles.inputError]}
          value={newCustomerDetails[name]}
          onChangeText={(text) => handleInputChange(name, text)}
          keyboardType={keyboardType}
          placeholder={`Enter ${label.toLowerCase().replace('*', '').trim()}`}
        />
        {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
      </View>
    );
  
    const renderExistingCustomerBottomSheet = () => {
      const translateY = bottomSheetAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
      });
  
      return (
        <Modal
          transparent={true}
          visible={isBottomSheetVisible}
          onRequestClose={hideBottomSheet}
          animationType="fade"
        >
          <View style={styles.bottomSheetOverlay}>
            <TouchableOpacity style={styles.bottomSheetBackdrop} onPress={hideBottomSheet} />
            <Animated.View
              style={[
                styles.bottomSheetContainer,
                {
                  transform: [{ translateY }],
                },
              ]}
            >
              <View style={styles.bottomSheetContent}>
                <Text style={styles.bottomSheetTitle}>Existing Customer Found</Text>
                {existingCustomer && (
                  <View style={styles.existingCustomerInfo}>
                    <Text style={styles.existingCustomerName}>{existingCustomer.storeName}</Text>
                    <Text style={styles.existingCustomerDetail}>
                      {existingCustomer.clientFirstName && existingCustomer.clientLastName
                        ? `${existingCustomer.clientFirstName} ${existingCustomer.clientLastName}`
                        : existingCustomer.clientName || 'N/A'}
                    </Text>
                    <Text style={styles.existingCustomerDetail}>{existingCustomer.primaryContact}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.viewCustomerButton}
                  onPress={() => {
                    hideBottomSheet();
                    handleClose();
                    navigation.navigate('CustomerDetails', { customerId: existingCustomer.storeId, authToken });
                  }}
                >
                  <Text style={styles.viewCustomerButtonText}>View Customer Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={hideBottomSheet}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>
      );
    };
  
    const renderNearbyStoresView = () => (
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.backButton} onPress={handleClose}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Nearby Stores</Text>
        </View>

        {/* Location Status & Radius Filter */}
        <View style={styles.filterContainer}>
          {locationError ? (
            <View style={styles.locationErrorContainer}>
              <Ionicons name="warning" size={20} color="#EF4444" />
              <Text style={styles.locationErrorText}>{locationError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchLocationAndNearbyStores}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !currentLocation ? (
            <View style={styles.locationLoadingContainer}>
              <ActivityIndicator size="small" color="#4F46E5" />
              <Text style={styles.locationLoadingText}>Fetching location...</Text>
            </View>
          ) : (
            <>
              <View style={styles.radiusFilterHeader}>
                <Ionicons name="radio-button-on" size={18} color="#4F46E5" />
                <Text style={styles.radiusFilterTitle}>Search Radius</Text>
              </View>
              <View style={styles.radiusFilterChips}>
                <TouchableOpacity
                  style={[
                    styles.radiusChip,
                    selectedRadius === 50 && styles.radiusChipActive
                  ]}
                  onPress={() => handleRadiusChange(50)}
                  disabled={loadingNearbyStores}
                >
                  <Text style={[
                    styles.radiusChipText,
                    selectedRadius === 50 && styles.radiusChipTextActive
                  ]}>
                    50m
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radiusChip,
                    selectedRadius === 100 && styles.radiusChipActive
                  ]}
                  onPress={() => handleRadiusChange(100)}
                  disabled={loadingNearbyStores}
                >
                  <Text style={[
                    styles.radiusChipText,
                    selectedRadius === 100 && styles.radiusChipTextActive
                  ]}>
                    100m
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radiusChip,
                    selectedRadius === 1000 && styles.radiusChipActive
                  ]}
                  onPress={() => handleRadiusChange(1000)}
                  disabled={loadingNearbyStores}
                >
                  <Text style={[
                    styles.radiusChipText,
                    selectedRadius === 1000 && styles.radiusChipTextActive
                  ]}>
                    1 km
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Nearby Stores List */}
        {loadingNearbyStores ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Finding nearby stores...</Text>
          </View>
        ) : nearbyStores.length > 0 ? (
          <ScrollView style={styles.storesList} contentContainerStyle={styles.storesListContent}>
            <Text style={styles.storesListTitle}>
              Found {nearbyStores.length} store{nearbyStores.length !== 1 ? 's' : ''} nearby
            </Text>
            {nearbyStores.map((store, index) => (
              <TouchableOpacity
                key={store.storeId || index}
                style={styles.storeItem}
                onPress={() => handleStoreItemClick(store)}
              >
                <View style={styles.storeItemContent}>
                  <View style={styles.storeItemHeader}>
                    <View style={styles.storeItemTitleContainer}>
                      <Text style={styles.storeItemName} numberOfLines={1}>
                        {store.storeName || 'Unnamed Store'}
                      </Text>
                      {store.distance !== undefined && (
                        <Text style={styles.storeDistance}>
                          {store.distance < 1000
                            ? `${Math.round(store.distance)}m`
                            : `${(store.distance / 1000).toFixed(2)}km`}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.storeItemInfoRow}>
                    <Ionicons name="person-outline" size={14} color="#6B7280" />
                    <Text style={styles.storeItemContact} numberOfLines={1}>
                      {store.clientFirstName} {store.clientLastName}
                    </Text>
                  </View>
                  
                  <View style={styles.storeItemInfoRow}>
                    <Ionicons name="call-outline" size={14} color="#6B7280" />
                    <Text style={styles.storeItemPhone}>{store.primaryContact}</Text>
                  </View>
                  
                  {(store.city || store.district) && (
                    <View style={styles.storeItemInfoRow}>
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text style={styles.storeItemLocation} numberOfLines={1}>
                        {[store.city, store.district].filter(Boolean).join(', ')}
                        {store.state && `, ${store.state}`}
                      </Text>
                    </View>
                  )}
                  
                  {store.addressLine1 && (
                    <View style={styles.storeItemInfoRow}>
                      <Ionicons name="home-outline" size={14} color="#6B7280" />
                      <Text style={styles.storeItemAddress} numberOfLines={2}>
                        {store.addressLine1}
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.storeItemFooter}>
                    <View style={[
                      styles.storeTypeBadge,
                      isDealerType(store.clientType) && styles.storeTypeBadgeDealer,
                      isProfessionalType(store.clientType) && styles.storeTypeBadgeProfessional,
                      isSiteVisitType(store.clientType) && styles.storeTypeBadgeSiteVisit,
                    ]}>
                      <Text style={[
                        styles.storeTypeText,
                        isDealerType(store.clientType) && styles.storeTypeTextDealer,
                        isProfessionalType(store.clientType) && styles.storeTypeTextProfessional,
                        isSiteVisitType(store.clientType) && styles.storeTypeTextSiteVisit,
                      ]}>
                        {store.clientType || 'N/A'}
                      </Text>
                    </View>
                    
                    {(store.lastVisitDate || store.totalVisitCount !== null) && (
                      <View style={styles.storeItemStats}>
                        {store.lastVisitDate && (
                          <View style={styles.storeStatItem}>
                            <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                            <Text style={styles.storeStatText}>
                              {format(new Date(store.lastVisitDate), 'MMM d')}
                            </Text>
                          </View>
                        )}
                        {store.totalVisitCount !== null && store.totalVisitCount > 0 && (
                          <View style={styles.storeStatItem}>
                            <Ionicons name="repeat-outline" size={12} color="#9CA3AF" />
                            <Text style={styles.storeStatText}>{store.totalVisitCount} visits</Text>
                          </View>
                        )}
                      </View>
                    )}
                    
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : !loadingNearbyStores && currentLocation ? (
          <View style={styles.noStoresContainer}>
            <Ionicons name="storefront-outline" size={64} color="#9CA3AF" />
            <Text style={styles.noStoresText}>No stores found nearby</Text>
            <Text style={styles.noStoresSubtext}>
              Create a new store to get started
            </Text>
          </View>
        ) : null}

        {/* Create Store Button */}
        <View style={styles.createStoreButtonContainer}>
          <TouchableOpacity
            style={styles.createStoreButton}
            onPress={handleCreateStoreClick}
          >
            <Ionicons name="add-circle" size={24} color="#FFFFFF" />
            <Text style={styles.createStoreButtonText}>Create New Store</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  
    return (
      <Modal visible={isVisible} animationType="slide" onRequestClose={handleClose}>
        {showNearbyStores ? (
          <View style={{ flex: 1 }}>
            {renderNearbyStoresView()}
          </View>
        ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
        >
      <ScrollView>
        <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                  <TouchableOpacity style={styles.backButton} onPress={() => setShowNearbyStores(true)}>
                  <Ionicons name="arrow-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Create New Customer</Text>
              </View>
  
              {/* Client Type Dropdown - Must be selected first */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Client Type*</Text>
                <CustomDropdown
                  options={clientTypeOptions}
                  placeholder="Select a client type"
                  onSelect={(option) => {
                    if (option && option.value) {
                      setSelectedClientType(option.value);
                      handleInputChange('clientType', option.value);
                    } else {
                      setSelectedClientType('');
                      handleInputChange('clientType', '');
                    }
                  }}
                  selectedOption={selectedClientType ? clientTypeOptions.find(o => o.value === selectedClientType) : null}
                />
                {errors.clientType && <Text style={styles.errorText}>{errors.clientType}</Text>}
              </View>

              {/* Basic Information */}
              <Text style={styles.sectionTitle}>Basic Information</Text>
              {renderInput('storeName', clientSpecificLabels.storeName)}
              {renderInput('clientName', clientSpecificLabels.clientName)}
              {renderInput('primaryContact', 'Primary Contact', 'phone-pad')}
             
              
              {/* Location Fields */}
              <Text style={styles.sectionTitle}>Location Details</Text>

              {/* State Dropdown */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>State*</Text>
                <CustomDropdown
                  data={states}
                  placeholder={loadingStates ? "Loading states..." : "Select State"}
                  value={newCustomerDetails.state}
                  onSelect={(value) => handleInputChange('state', value)}
                  loading={loadingStates}
                />
                {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
              </View>

              {/* District Dropdown */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>District*</Text>
                <CustomDropdown
                  data={districts}
                  placeholder={loadingDistricts ? "Loading districts..." : "Select District"}
                  value={newCustomerDetails.district}
                  onSelect={(value) => handleInputChange('district', value)}
                  loading={loadingDistricts}
                  disabled={!newCustomerDetails.state}
                />
                {errors.district && <Text style={styles.errorText}>{errors.district}</Text>}
              </View>

              {/* Sub-District / Taluka */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Taluka / Village*</Text>
                <TextInput
                  style={[styles.input, errors.taluka && styles.inputError]}
                  value={newCustomerDetails.taluka}
                  onChangeText={(value) => handleInputChange('taluka', value)}
                  placeholder="Enter taluka or village"
                />
                {errors.taluka && <Text style={styles.errorText}>{errors.taluka}</Text>}
              </View>

              {renderInput('city', 'City*')}

              {renderInput('addressLine1', 'Address Line 1')}
              
              {renderInput('pincode', 'Pincode', 'numeric')}

              {/*
             
              <View style={styles.inputContainer}>
                <Text style={styles.label}>State (From Employee Profile)</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{newCustomerDetails.state || 'Loading...'}</Text>
                </View>
              </View>
  
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Country (From Employee Profile)</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{newCustomerDetails.country || 'Loading...'}</Text>
                </View>
              </View>
              */}
  
              {/* GPS Coordinates - Required for all customer types */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>GPS Coordinates*</Text>
                <View style={styles.gpsContainer}>
                  {newCustomerDetails.latitude && newCustomerDetails.longitude ? (
                    <View style={styles.gpsCoordinates}>
                      <Ionicons name="location" size={20} color="#4F46E5" />
                      <View style={styles.gpsValues}>
                        <Text style={styles.gpsText}>Lat: {parseFloat(newCustomerDetails.latitude).toFixed(6)}</Text>
                        <Text style={styles.gpsText}>Long: {parseFloat(newCustomerDetails.longitude).toFixed(6)}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.gpsPlaceholder}>No GPS coordinates captured</Text>
                  )}
                  <TouchableOpacity 
                    style={styles.gpsButton}
                    onPress={fetchCurrentLocation}
                    disabled={fetchingLocation}
                  >
                    {fetchingLocation ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="locate" size={20} color="#FFFFFF" />
                        <Text style={styles.gpsButtonText}>
                          {newCustomerDetails.latitude ? 'Update Location' : 'Capture Location'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                {errors.gpsLocation && <Text style={styles.errorText}>{errors.gpsLocation}</Text>}
              </View>

              {/* Site Visit Specific Fields */}
              {selectedClientType === 'Site Visit' && (
                <>
                  <View style={styles.siteVisitSection}>
                    <Text style={styles.sectionTitle}>Site Visit Details</Text>
                    
                    {/* Engineer Name Dropdown */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Engineer Name</Text>
                      <View style={styles.dropdownWithCreateContainer}>
                        <CustomDropdown
                          options={engineersList.map(eng => ({ label: eng.name, value: eng.id }))}
                          placeholder={loadingEngineers ? "Loading engineers..." : "Select Engineer"}
                          onSelect={(option) => {
                            if (option) {
                              setSelectedEngineer(option);
                              const engineer = engineersList.find(e => e.id === option.value);
                              setNewCustomerDetails(prev => ({
                                ...prev,
                                engineerName: engineer?.name || option.label,
                                engineerId: option.value,
                              }));
                            } else {
                              setSelectedEngineer(null);
                              setNewCustomerDetails(prev => ({
                                ...prev,
                                engineerName: '',
                                engineerId: null,
                              }));
                            }
                          }}
                          selectedOption={selectedEngineer}
                          disabled={loadingEngineers}
                        />
                      </View>
                    </View>

                    {/* Contractor Name Dropdown */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Contractor Name</Text>
                      <View style={styles.dropdownWithCreateContainer}>
                        <CustomDropdown
                          options={contractorsList.map(con => ({ label: con.name, value: con.id }))}
                          placeholder={loadingContractors ? "Loading contractors..." : "Select Contractor"}
                          onSelect={(option) => {
                            if (option) {
                              setSelectedContractor(option);
                              const contractor = contractorsList.find(c => c.id === option.value);
                              setNewCustomerDetails(prev => ({
                                ...prev,
                                contractorName: contractor?.name || option.label,
                                contractorId: option.value,
                              }));
                            } else {
                              setSelectedContractor(null);
                              setNewCustomerDetails(prev => ({
                                ...prev,
                                contractorName: '',
                                contractorId: null,
                              }));
                            }
                          }}
                          selectedOption={selectedContractor}
                          disabled={loadingContractors}
                        />
                      </View>
                    </View>

                    {/* Area Field */}
                    {renderInput('area', 'Area')}

                    {/* Project Type */}
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Project Type</Text>
                      <CustomDropdown
                        options={projectTypeOptions}
                        placeholder="Select project type"
                        onSelect={(option) => {
                          setSelectedProjectType(option);
                          handleInputChange('projectType', option ? option.value : '');
                        }}
                        selectedOption={selectedProjectType}
                      />
                      {errors.projectType && <Text style={styles.errorText}>{errors.projectType}</Text>}
                    </View>
                    
                    {renderInput('projectSize', 'Project Size in sq ft', 'numeric')}
                  </View>
                </>
              )}

              {/* Engineer/Architect/Contractor Specific Fields */}
              {isProfessionalType(selectedClientType) && (
                <>
                  <View style={styles.professionalSection}>
                    <Text style={styles.sectionTitle}>Professional Details</Text>
                    
                    {renderInput('firmName', 'Firm Name')}
                    
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Date of Birth*</Text>
                      <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setIsDobPickerVisible(true)}
                      >
                        <Text style={styles.dateButtonText}>
                          {newCustomerDetails.dateOfBirth || 'Select date of birth'}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                      </TouchableOpacity>
                      {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
                    </View>

                    {renderInput('email', 'Email')}
                    
                    {renderInput('yearsOfExperience', 'Years of Experience*', 'numeric')}
                  </View>
                </>
              )}

              {/* Dealer/Shop Specific Fields */}
              {isDealerType(selectedClientType) && (
                <>
                  <View style={styles.dealerShopSection}>
                    <Text style={styles.sectionTitle}>Dealer/Shop Details</Text>
                    
                    {renderInput('shopAgeYears', 'Shop Age (in years)*', 'numeric')}
                    
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Shop Ownership*</Text>
                      <CustomDropdown
                        options={shopOwnershipOptions}
                        placeholder="Select ownership type"
                        onSelect={(option) => {
                          setSelectedShopOwnership(option);
                          handleInputChange('ownershipType', option ? option.value : '');
                        }}
                        selectedOption={selectedShopOwnership}
                      />
                      {errors.ownershipType && <Text style={styles.errorText}>{errors.ownershipType}</Text>}
                    </View>
                    
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Dealer Type*</Text>
                      <CustomDropdown
                        options={dealerTypeOptions}
                        placeholder="Select dealer type"
                        onSelect={(option) => {
                          setSelectedDealerType(option);
                          if (option?.value === 'NON_ICON') {
                            setSelectedDealerSubType(null);
                          }
                          handleInputChange('dealerType', option ? option.value : '');
                        }}
                        selectedOption={selectedDealerType}
                      />
                      {errors.dealerType && <Text style={styles.errorText}>{errors.dealerType}</Text>}
                    </View>
                    
                    {newCustomerDetails.dealerType === 'ICON' && (
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Dealer Sub-Type*</Text>
                        <CustomDropdown
                          options={dealerSubTypeOptions}
                          placeholder="Select dealer sub-type"
                          onSelect={(option) => {
                            setSelectedDealerSubType(option);
                            handleInputChange('dealerSubType', option ? option.value : '');
                          }}
                          selectedOption={selectedDealerSubType}
                        />
                        {errors.dealerSubType && <Text style={styles.errorText}>{errors.dealerSubType}</Text>}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Product Categories Section */}
              {selectedClientType && productCategoryOptions.length > 0 && (
                <View style={styles.materialsSection}>
                  <Text style={styles.sectionTitle}>Products</Text>
                  <Text style={styles.sectionSubtitle}>Select all relevant products for this client type. This helps tailor future follow-ups.</Text>
                  
                  <View style={styles.materialsGrid}>
                    {productCategoryOptions.map((material) => (
                      <TouchableOpacity
                        key={material.value}
                        style={[
                          styles.materialCheckbox,
                          selectedMaterials.includes(material.value) && styles.materialCheckboxSelected
                        ]}
                        onPress={() => handleMaterialToggle(material.value)}
                      >
                        <View style={[
                          styles.checkbox,
                          selectedMaterials.includes(material.value) && styles.checkboxSelected
                        ]}>
                          {selectedMaterials.includes(material.value) && (
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          )}
                        </View>
                        <Text style={[
                          styles.materialLabel,
                          selectedMaterials.includes(material.value) && styles.materialLabelSelected
                        ]}>
                          {material.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom Categories */}
                  {customMaterials.length > 0 && (
                    <View style={styles.customMaterialsList}>
                      {customMaterials.map((material) => (
                        <View key={material} style={styles.customMaterialItem}>
                          <TouchableOpacity
                            style={styles.customMaterialCheckbox}
                            onPress={() => handleMaterialToggle(material)}
                          >
                            <View style={[
                              styles.checkbox,
                              selectedMaterials.includes(material) && styles.checkboxSelected
                            ]}>
                              {selectedMaterials.includes(material) && (
                                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                              )}
                            </View>
                            <Text style={[
                              styles.materialLabel,
                              selectedMaterials.includes(material) && styles.materialLabelSelected
                            ]}>
                              {material}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemoveCustomMaterial(material)}
                            style={styles.removeButton}
                          >
                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                {/* Add Custom Category on demand */}
                {showAddMaterialInput ? (
                  <View style={styles.addMaterialContainer}>
                    <TextInput
                      style={styles.addMaterialInput}
                      value={customMaterial}
                      onChangeText={setCustomMaterial}
                      placeholder="Add another"
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity
                      style={[
                        styles.addMaterialButton,
                        !customMaterial.trim() && styles.addMaterialButtonDisabled
                      ]}
                      onPress={handleAddCustomMaterial}
                      disabled={!customMaterial.trim()}
                    >
                      <Text style={styles.addMaterialButtonText}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelAddButton}
                      onPress={() => setShowAddMaterialInput(false)}
                    >
                      <Text style={styles.cancelAddButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addAnotherLink}
                    onPress={() => setShowAddMaterialInput(true)}
                  >
                    <Text style={styles.addAnotherLinkText}>+ Add another category</Text>
                  </TouchableOpacity>
                )}
                </View>
              )}
  
              <View style={styles.createButtonsContainer}>
              <TouchableOpacity 
                  style={[styles.createButton, styles.createButtonSecondary]} 
                onPress={handleCreateCustomer}
                disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#4F46E5" />
                  ) : (
                    <>
                      <Ionicons name="storefront-outline" size={18} color="#4F46E5" />
                      <Text style={styles.createButtonTextSecondary}>Create Store</Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.createButton} 
                  onPress={handleCreateStoreAndVisit}
                  disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <>
                      <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.createButtonText}>Create Store & Visit</Text>
                    </>
                )}
              </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        )}
        {renderExistingCustomerBottomSheet()}
        
        {/* Date of Birth Picker */}
        <DobPicker
          isVisible={isDobPickerVisible}
          onClose={() => setIsDobPickerVisible(false)}
          onSelect={handleDobSelect}
          maxDate={new Date()} // Can't select future dates
        />

      </Modal>
    );
  };
  
  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: '#FFFFFF',
      paddingHorizontal: 24,
      paddingTop: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    backButton: {
      marginRight: 16,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1F2937',
    },
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#1F2937',
      marginBottom: 8,
    },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#4F46E5',
      marginBottom: 16,
      marginTop: 16,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: '#6B7280',
      marginBottom: 12,
      marginTop: -8,
      fontStyle: 'italic',
    },
    readOnlyField: {
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    readOnlyText: {
      fontSize: 16,
      color: '#6B7280',
    },
  professionalSection: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#93C5FD',
  },
  dealerShopSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  siteVisitSection: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
    dateButtonText: {
      fontSize: 16,
      color: '#1F2937',
    },
  gpsContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
    gpsCoordinates: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      backgroundColor: '#EEF2FF',
      padding: 12,
      borderRadius: 8,
    },
    gpsValues: {
      marginLeft: 12,
      flex: 1,
    },
    gpsText: {
      fontSize: 14,
      color: '#1F2937',
      marginBottom: 4,
    },
    gpsPlaceholder: {
      fontSize: 14,
      color: '#9CA3AF',
      marginBottom: 12,
      textAlign: 'center',
      paddingVertical: 8,
    },
    gpsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4F46E5',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 8,
    },
    gpsButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    inputError: {
      borderColor: '#EF4444',
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      marginTop: 4,
    },
    createButtonsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
      marginBottom: 32,
    },
    createButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4F46E5',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 6,
    },
    createButtonSecondary: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: '#4F46E5',
    },
    createButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    createButtonTextSecondary: {
      fontSize: 14,
      fontWeight: '600',
      color: '#4F46E5',
    },
    bottomSheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    bottomSheetBackdrop: {
      flex: 1,
    },
    bottomSheetContainer: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    bottomSheetContent: {
      // Content styles
    },
    bottomSheetTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1F2937',
      marginBottom: 16,
    },
    existingCustomerInfo: {
      marginBottom: 20,
    },
    existingCustomerName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1F2937',
      marginBottom: 8,
    },
    existingCustomerDetail: {
      fontSize: 16,
      color: '#4B5563',
      marginBottom: 4,
    },
    viewCustomerButton: {
      backgroundColor: '#4F46E5',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 24,
      alignItems: 'center',
      marginBottom: 12,
    },
    viewCustomerButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },
    cancelButton: {
      backgroundColor: '#E5E7EB',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 24,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#4B5563',
    },
    // Materials of Interest styles
    materialsSection: {
      backgroundColor: '#F9FAFB',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    materialsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    materialCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minWidth: '45%',
    },
    materialCheckboxSelected: {
      backgroundColor: '#EEF2FF',
      borderColor: '#4F46E5',
      borderWidth: 2,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#D1D5DB',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    checkboxSelected: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    materialLabel: {
      fontSize: 14,
      color: '#4B5563',
      fontWeight: '500',
    },
    materialLabelSelected: {
      color: '#4F46E5',
      fontWeight: '600',
    },
    customMaterialsList: {
      marginBottom: 16,
    },
    customMaterialItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    customMaterialCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    removeButton: {
      padding: 4,
    },
    addMaterialContainer: {
      flexDirection: 'row',
      gap: 8,
    },
    addMaterialInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      backgroundColor: '#FFFFFF',
      color: '#1F2937',
    },
    addMaterialButton: {
      backgroundColor: '#4F46E5',
      borderRadius: 8,
      paddingHorizontal: 20,
      paddingVertical: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addMaterialButtonDisabled: {
      backgroundColor: '#9CA3AF',
      opacity: 0.5,
    },
    addMaterialButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    addAnotherLink: {
      paddingVertical: 8,
    },
    addAnotherLinkText: {
      color: '#4F46E5',
      fontSize: 14,
      fontWeight: '600',
    },
    cancelAddButton: {
      backgroundColor: '#E5E7EB',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelAddButtonText: {
      color: '#374151',
      fontSize: 14,
      fontWeight: '600',
    },
    // Nearby stores view styles
    filterContainer: {
      marginBottom: 12,
      padding: 12,
      backgroundColor: '#F9FAFB',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    radiusFilterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    radiusFilterTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#1F2937',
    },
    radiusFilterChips: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    radiusChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: '#FFFFFF',
      borderWidth: 1.5,
      borderColor: '#D1D5DB',
      minWidth: 70,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radiusChipActive: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
      shadowColor: '#4F46E5',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    radiusChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#6B7280',
    },
    radiusChipTextActive: {
      color: '#FFFFFF',
    },
    locationErrorContainer: {
      alignItems: 'center',
      gap: 8,
    },
    locationErrorText: {
      fontSize: 14,
      color: '#EF4444',
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: '#4F46E5',
      borderRadius: 6,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    locationLoadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'center',
    },
    locationLoadingText: {
      fontSize: 14,
      color: '#6B7280',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: '#6B7280',
    },
    storesList: {
      flex: 1,
    },
    storesListContent: {
      paddingBottom: 16,
    },
    storesListTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#1F2937',
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    storeItem: {
      backgroundColor: '#FFFFFF',
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    storeItemContent: {
      padding: 12,
    },
    storeItemHeader: {
      marginBottom: 10,
    },
    storeItemTitleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    storeItemName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1F2937',
      flex: 1,
      marginRight: 8,
    },
    storeItemInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      gap: 6,
    },
    storeDistance: {
      fontSize: 12,
      fontWeight: '600',
      color: '#4F46E5',
      backgroundColor: '#EEF2FF',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
    },
    storeItemContact: {
      fontSize: 14,
      color: '#4B5563',
      flex: 1,
    },
    storeItemPhone: {
      fontSize: 13,
      color: '#6B7280',
      flex: 1,
    },
    storeItemLocation: {
      fontSize: 12,
      color: '#6B7280',
      flex: 1,
    },
    storeItemAddress: {
      fontSize: 12,
      color: '#6B7280',
      flex: 1,
      lineHeight: 18,
    },
    storeItemFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      marginTop: 4,
    },
    storeTypeBadge: {
      backgroundColor: '#F3F4F6',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    storeTypeBadgeDealer: {
      backgroundColor: '#EEF2FF',
    },
    storeTypeBadgeProfessional: {
      backgroundColor: '#F0FDF4',
    },
    storeTypeBadgeSiteVisit: {
      backgroundColor: '#FEF3C7',
    },
    storeTypeText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#4B5563',
      textTransform: 'uppercase',
    },
    storeTypeTextDealer: {
      color: '#4F46E5',
    },
    storeTypeTextProfessional: {
      color: '#059669',
    },
    storeTypeTextSiteVisit: {
      color: '#D97706',
    },
    storeItemStats: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      flex: 1,
      marginLeft: 8,
    },
    storeStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    storeStatText: {
      fontSize: 11,
      color: '#9CA3AF',
    },
    noStoresContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    noStoresText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#1F2937',
      marginTop: 16,
      marginBottom: 8,
    },
    noStoresSubtext: {
      fontSize: 14,
      color: '#6B7280',
      textAlign: 'center',
    },
    createStoreButtonContainer: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      backgroundColor: '#FFFFFF',
    },
    createStoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#4F46E5',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      gap: 6,
    },
    createStoreButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    dropdownWithCreateContainer: {
      width: '100%',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    createProfessionalModal: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      width: '90%',
      maxHeight: '80%',
      padding: 20,
    },
    modalContent: {
      maxHeight: 400,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 20,
      gap: 10,
    },
    modalButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      minWidth: 100,
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: '#E5E7EB',
    },
    modalButtonCancelText: {
      color: '#374151',
      fontWeight: '600',
    },
    modalButtonConfirm: {
      backgroundColor: '#4F46E5',
    },
    modalButtonConfirmText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });
  
  export default CreateCustomerComponent;
