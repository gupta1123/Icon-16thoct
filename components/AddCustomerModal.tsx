"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { API, type StateDto, type DistrictDto, type SubDistrictDto, type CityDto } from '@/lib/api';

const CUSTOM_CLIENT_TYPE_VALUE = 'Custom';
const CUSTOM_CLIENT_TYPE_LABEL = 'Custom Mix';
const CUSTOM_CLIENT_DEFAULT_OPTIONS = ['Structure', 'Tiles', 'Pipes', 'Paints', 'Adhesives'] as const;

// Customer type options
const CUSTOMER_TYPES = [
  { value: 'Dealer', label: 'Dealer/Shop' },
  { value: 'Professional', label: 'Engineer/Architect/Contractor' },
  { value: 'Site Visit', label: 'Site Visit/Project' },
  { value: CUSTOM_CLIENT_TYPE_VALUE, label: CUSTOM_CLIENT_TYPE_LABEL },
];

// Project type options for Site Visit
const PROJECT_TYPES = [
  { value: 'HOME', label: 'Home' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'GOVT_PROJECT', label: 'Government Project' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'OTHERS', label: 'Others' }
];

// Ownership type options
const OWNERSHIP_TYPES = [
  { value: 'OWNED', label: 'Owned' },
  { value: 'RENTED', label: 'Rented' }
];

// Dealer type options
const DEALER_TYPES = [
  { value: 'ICON', label: 'ICON' },
  { value: 'NON_ICON', label: 'Non-ICON' }
];

// Dealer sub-type options
const DEALER_SUB_TYPES = [
  { value: 'EXCLUSIVE', label: 'Exclusive' },
  { value: 'NON_EXCLUSIVE', label: 'Non-Exclusive' }
];

interface CustomerData {
  id?: number;
  storeName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  primaryContact?: string | number;
  secondaryContact?: string | number;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  subDistrict?: string;
  state?: string;
  country?: string;
  pincode?: string | number;
  gstNumber?: string;
  monthlySale?: string | number;
  clientType?: string;
  
  // Dealer/Shop specific fields
  shopAgeYears?: number;
  ownershipType?: string; // RENTED, OWNED
  dealerType?: string; // ICON, NON_ICON
  dealerSubType?: string; // EXCLUSIVE, NON_EXCLUSIVE
  
  // Engineer/Architect/Contractor specific fields
  dateOfBirth?: string;
  yearsOfExperience?: string;
  
  // Site Visit specific fields
  contractorName?: string;
  engineerName?: string;
  projectType?: string; // HOME, APARTMENT, GOVT_PROJECT, COMMERCIAL, INDUSTRIAL, OTHERS
  projectSizeSquareFeet?: number;
  
  // GPS coordinates
  latitude?: number;
  longitude?: number;
}

const formatCustomCategory = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const decodeCustomClientType = (raw?: string | null): string[] => {
  if (!raw) return [];
  const normalized = raw.trim();
  if (!normalized.toLowerCase().startsWith('custom')) return [];

  const separatorIndex =
    normalized.indexOf('-') !== -1 ? normalized.indexOf('-') : normalized.indexOf(':');
  if (separatorIndex === -1) return [];

  const listPortion = normalized.slice(separatorIndex + 1);
  return listPortion
    .split(',')
    .map(formatCustomCategory)
    .filter(Boolean);
};

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  employeeId: number | null;
  existingData?: CustomerData;
  onCustomerAdded?: () => void;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  token,
  employeeId,
  existingData,
  onCustomerAdded,
}) => {
  const initialCustomSelections = useMemo(
    () => decodeCustomClientType(existingData?.clientType),
    [existingData?.clientType]
  );
  const existingDataRef = useRef<CustomerData | undefined>(existingData);
  existingDataRef.current = existingData;

  const [customerData, setCustomerData] = useState<CustomerData>(
    existingData
      ? {
          ...existingData,
          clientType:
            initialCustomSelections.length > 0 ? CUSTOM_CLIENT_TYPE_VALUE : existingData.clientType,
        }
      : {
          clientFirstName: '',
          clientLastName: '',
          email: '',
          clientType: 'Dealer', // Default to Dealer
        }
  );
  const [customClientOptions, setCustomClientOptions] = useState<string[]>(() => {
    const base = Array.from(CUSTOM_CLIENT_DEFAULT_OPTIONS);
    if (initialCustomSelections.length === 0) return base;
    return Array.from(new Set([...base, ...initialCustomSelections]));
  });
  const [customClientSelections, setCustomClientSelections] = useState<string[]>(initialCustomSelections);
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [customClientValidationError, setCustomClientValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const currentExisting = existingDataRef.current;
    const selections = decodeCustomClientType(currentExisting?.clientType);

    if (currentExisting) {
      setCustomerData({
        ...currentExisting,
        clientType: selections.length > 0 ? CUSTOM_CLIENT_TYPE_VALUE : currentExisting.clientType,
      });
      setCustomClientOptions(() => {
        const base = Array.from(CUSTOM_CLIENT_DEFAULT_OPTIONS);
        return Array.from(new Set([...base, ...selections]));
      });
      setCustomClientSelections(selections);
    } else {
      setCustomerData({
        clientFirstName: '',
        clientLastName: '',
        email: '',
        clientType: 'Dealer',
      });
      setCustomClientOptions(Array.from(CUSTOM_CLIENT_DEFAULT_OPTIONS));
      setCustomClientSelections([]);
    }

    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
    setCustomClientValidationError(null);
  }, [isOpen, existingData?.id]);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  
  // Phone number validation errors
  const [primaryContactError, setPrimaryContactError] = useState<string>('');
  const [secondaryContactError, setSecondaryContactError] = useState<string>('');
  
  // Location state
  const [states, setStates] = useState<StateDto[]>([]);
  const [districts, setDistricts] = useState<DistrictDto[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrictDto[]>([]);
  const [cities, setCities] = useState<CityDto[]>([]);
  
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedSubDistrictId, setSelectedSubDistrictId] = useState<number | null>(null);
  
  // Search states for dropdowns
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [subDistrictSearch, setSubDistrictSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  // Filtered data based on search
  const filteredStates = states.filter(state =>
    state.stateName.toLowerCase().includes(stateSearch.toLowerCase())
  );
  
  const filteredDistricts = districts.filter(district =>
    district.districtName.toLowerCase().includes(districtSearch.toLowerCase())
  );
  
  const filteredSubDistricts = subDistricts.filter(subDistrict =>
    subDistrict.subDistrictName.toLowerCase().includes(subDistrictSearch.toLowerCase())
  );
  
  const filteredCities = cities.filter(city =>
    city.cityName.toLowerCase().includes(citySearch.toLowerCase())
  );

  // Load states on mount
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const statesData = await API.getAllStates();
        setStates(statesData);
        console.log('States loaded:', statesData.length);
      } catch (error) {
        console.error('Error fetching states:', error);
        setStates([]);
      }
    };

    fetchStates();
  }, []);


  // Load districts when state changes
  useEffect(() => {
    const fetchDistricts = async () => {
      if (!selectedStateId) {
        setDistricts([]);
        setSubDistricts([]);
        setCities([]);
        setSelectedDistrictId(null);
        setSelectedSubDistrictId(null);
        return;
      }

      try {
        const districtsData = await API.getDistrictsByStateId(selectedStateId);
        setDistricts(districtsData);
        setSubDistricts([]);
        setCities([]);
        setSelectedDistrictId(null);
        setSelectedSubDistrictId(null);
        console.log('Districts loaded:', districtsData.length);
      } catch (error) {
        console.error('Error fetching districts:', error);
        setDistricts([]);
      }
    };

    fetchDistricts();
  }, [selectedStateId]);

  // Load sub-districts when district changes
  useEffect(() => {
    const fetchSubDistricts = async () => {
      if (!selectedDistrictId) {
        setSubDistricts([]);
        setCities([]);
        setSelectedSubDistrictId(null);
        return;
      }

      try {
        const subDistrictsData = await API.getSubDistrictsByDistrictId(selectedDistrictId);
        setSubDistricts(subDistrictsData);
        setCities([]);
        setSelectedSubDistrictId(null);
        console.log('Sub-districts loaded:', subDistrictsData.length);
      } catch (error) {
        console.error('Error fetching sub-districts:', error);
        setSubDistricts([]);
      }
    };

    fetchSubDistricts();
  }, [selectedDistrictId]);

  // Load cities when sub-district changes
  useEffect(() => {
    const fetchCities = async () => {
      if (!selectedSubDistrictId) {
        setCities([]);
        return;
      }

      try {
        const citiesData = await API.getCitiesBySubDistrictId(selectedSubDistrictId);
        setCities(citiesData);
        console.log('Cities loaded:', citiesData.length);
      } catch (error) {
        console.error('Error fetching cities:', error);
        setCities([]);
      }
    };

    fetchCities();
  }, [selectedSubDistrictId]);

  const handlePhoneChange = (field: 'primaryContact' | 'secondaryContact', value: string) => {
    // Remove any non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limitedValue = digitsOnly.slice(0, 10);
    
    // Validate phone number
    if (limitedValue.length > 0 && limitedValue.length < 10) {
      if (field === 'primaryContact') {
        setPrimaryContactError('Phone number must be exactly 10 digits');
      } else {
        setSecondaryContactError('Phone number must be exactly 10 digits');
      }
    } else {
      if (field === 'primaryContact') {
        setPrimaryContactError('');
      } else {
        setSecondaryContactError('');
      }
    }
    
    // Update customer data
    setCustomerData((prevData) => ({
      ...prevData,
      [field]: limitedValue === '' ? '' : limitedValue,
    }));
  };

  const handleInputChange = (field: keyof CustomerData, value: string | number) => {
    let parsedValue: string | number = value;
    const numberFields: (keyof CustomerData)[] = ['pincode', 'monthlySale', 'shopAgeYears', 'projectSizeSquareFeet'];
    if (numberFields.includes(field)) {
      parsedValue = value === '' ? '' : parseInt(value.toString(), 10);
    }

    setCustomerData((prevData) => ({
      ...prevData,
      [field]: parsedValue,
    }));
    if (field === 'clientType' && value !== CUSTOM_CLIENT_TYPE_VALUE) {
      setCustomClientValidationError(null);
      setIsAddingCustomCategory(false);
      setCustomCategoryInput('');
    }
  };

  // Get GPS location from browser
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSubmitError('Geolocation is not supported by this browser');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCustomerData((prevData) => ({
          ...prevData,
          latitude,
          longitude,
        }));
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setSubmitError('Unable to get your location. Please enter coordinates manually.');
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  // Helper function to get dynamic labels based on customer type
  const getLabelForStoreName = (clientType: string): string => {
    switch (clientType) {
      case 'Dealer': return 'Shop Name';
      case 'Professional': return 'Firm Name';
      case 'Site Visit': return 'Project Name';
      case CUSTOM_CLIENT_TYPE_VALUE: return 'Business Name';
      default: return 'Store Name';
    }
  };

  const getLabelForOwner = (clientType: string): string => {
    if (clientType === 'Site Visit') return 'Site Owner Name';
    if (clientType === CUSTOM_CLIENT_TYPE_VALUE) return 'Primary Contact Name';
    return 'Owner Name';
  };

  const handleSubmit = async () => {
    try {
      setSubmitError(null);
      
      // Validate phone numbers
      if (primaryContactError || secondaryContactError) {
        setSubmitError('Please fix phone number errors before submitting');
        return;
      }
      
      // Check primary contact length
      const primaryContactStr = customerData.primaryContact?.toString() || '';
      if (primaryContactStr.length > 0 && primaryContactStr.length !== 10) {
        setPrimaryContactError('Phone number must be exactly 10 digits');
        setSubmitError('Primary contact must be exactly 10 digits');
        return;
      }
      
      // Check secondary contact length if provided
      const secondaryContactStr = customerData.secondaryContact?.toString() || '';
      if (secondaryContactStr.length > 0 && secondaryContactStr.length !== 10) {
        setSecondaryContactError('Phone number must be exactly 10 digits');
        setSubmitError('Secondary contact must be exactly 10 digits');
        return;
      }
      
      // Basic validation for required fields expected by backend
      const requiredFields: Array<[keyof CustomerData, string]> = [
        ['storeName', 'Store Name'],
        ['clientFirstName', 'First Name'],
        ['primaryContact', 'Primary Contact'],
        ['city', 'City'],
        ['state', 'State'],
        ['clientType', 'Client Type'],
        ['latitude', 'GPS Latitude'],
        ['longitude', 'GPS Longitude'],
      ];
      const missing = requiredFields
        .filter(([key]) => !customerData[key] && customerData[key] !== 0)
        .map(([, label]) => label);
      if (missing.length) {
        setSubmitError(`Please fill required fields: ${missing.join(', ')}`);
        return;
      }

      // Validate GPS coordinates
      if (customerData.latitude && (customerData.latitude < -90 || customerData.latitude > 90)) {
        setSubmitError('Latitude must be between -90 and 90');
        return;
      }
      if (customerData.longitude && (customerData.longitude < -180 || customerData.longitude > 180)) {
        setSubmitError('Longitude must be between -180 and 180');
        return;
      }

      const cleanDigits = (val: string | number | undefined) => {
        if (val === undefined || val === null || val === '') return undefined;
        const s = val.toString().replace(/\D/g, '');
        return s ? parseInt(s, 10) : undefined;
      };

      let finalClientType =
        typeof customerData.clientType === 'string' ? customerData.clientType : '';
      if (customerData.clientType === CUSTOM_CLIENT_TYPE_VALUE) {
        const uniqueSelections = Array.from(
          new Set(customClientSelections.map(formatCustomCategory).filter(Boolean))
        );
        if (uniqueSelections.length === 0) {
          const message = 'Select at least one material category or add your own.';
          setCustomClientValidationError(message);
          setSubmitError(message);
          return;
        }
        setCustomClientValidationError(null);
        finalClientType = `Custom - ${uniqueSelections.join(', ')}`;
      }

      const requestBody = {
        ...customerData,
        clientType: finalClientType,
        primaryContact: cleanDigits(customerData.primaryContact),
        secondaryContact: cleanDigits(customerData.secondaryContact),
        pincode: cleanDigits(customerData.pincode),
        monthlySale: cleanDigits(customerData.monthlySale),
        shopAgeYears: customerData.shopAgeYears ? parseInt(customerData.shopAgeYears.toString(), 10) : undefined,
        projectSizeSquareFeet: customerData.projectSizeSquareFeet ? parseFloat(customerData.projectSizeSquareFeet.toString()) : undefined,
        // Use actual GPS coordinates or default to null if not available
        latitude: customerData.latitude || null,
        longitude: customerData.longitude || null,
        employeeId: employeeId || null, // Use logged-in user's employee ID (auto-assigned)
      };

      console.log('requestBody', requestBody)
      const url = existingData && existingData.id
        ? `/api/proxy/store/edit?id=${existingData.id}`
        : '/api/proxy/store/create';
      const method = existingData && existingData.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Add/Update customer response status:', response.status)
      if (response.ok) {
        const data = await response.json();
        console.log(data)
        onClose(); // Close the modal after successful submission
        if (onCustomerAdded) {
          onCustomerAdded(); // Refresh the customers list
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to update/create customer', response.status, errorText);
        setSubmitError(errorText || 'Failed to update/create customer');
        // Handle error case, e.g., show an error message to the user
      }
    } catch (error) {
      console.error('Error updating/creating customer:', error);
      setSubmitError('Unexpected error while saving customer');
      // Handle error case, e.g., show an error message to the user
    }
  };

  const handleNext = () => {
    if (activeTab === 'basic') {
      setActiveTab('contact');
    } else if (activeTab === 'contact') {
      setActiveTab('address');
    } else if (activeTab === 'address') {
      setActiveTab('additional');
    }
  };

  const handlePrevious = () => {
    if (activeTab === 'additional') {
      setActiveTab('address');
    } else if (activeTab === 'address') {
      setActiveTab('contact');
    } else if (activeTab === 'contact') {
      setActiveTab('basic');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>Enter the details of the new customer.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          {submitError && (
            <div className="mb-3 rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </div>
          )}
          <TabsList>
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="additional">Additional</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="mt-4">
            <div className="space-y-4">
              {/* Customer Type Selection */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="clientType" className="text-right">
                  Customer Type *
                </Label>
                <Select
                  value={customerData.clientType || 'Dealer'}
                  onValueChange={(value) => {
                    handleInputChange('clientType', value);
                    if (value === CUSTOM_CLIENT_TYPE_VALUE) {
                      setCustomClientValidationError(null);
                    } else {
                      setCustomClientValidationError(null);
                      setIsAddingCustomCategory(false);
                      setCustomCategoryInput('');
                    }
                  }}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select customer type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Materials of Interest - Custom Mix Section */}
              {customerData.clientType === CUSTOM_CLIENT_TYPE_VALUE && (
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Materials of Interest</p>
                    <p className="text-xs text-muted-foreground">
                      Select all relevant categories. This helps tailor future follow-ups.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {customClientOptions.map((option) => {
                      const normalized = formatCustomCategory(option);
                      const isChecked = customClientSelections.includes(normalized);
                      const inputId = `custom-client-option-${normalized.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
                      return (
                        <label
                          key={option}
                          htmlFor={inputId}
                          className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                            isChecked
                              ? 'border-primary bg-primary/10 text-primary shadow-sm'
                              : 'border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5'
                          }`}
                        >
                          <Checkbox
                            id={inputId}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setCustomClientSelections((prev) => {
                                if (checked) {
                                  return prev.includes(normalized) ? prev : [...prev, normalized];
                                }
                                return prev.filter((item) => item !== normalized);
                              });
                              setCustomClientValidationError(null);
                            }}
                          />
                          <span className="select-none">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                  {customClientSelections.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-muted-foreground mr-1">Selected:</span>
                      {customClientSelections.map((selection) => (
                        <Badge key={selection} variant="secondary" className="text-xs font-medium">
                          {selection}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2 pt-1">
                    {isAddingCustomCategory ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={customCategoryInput}
                          onChange={(e) => setCustomCategoryInput(e.target.value)}
                          placeholder="Add another material type"
                          className="sm:flex-1 h-9"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const formatted = formatCustomCategory(customCategoryInput);
                              if (!formatted) {
                                setCustomClientValidationError('Enter a material name before adding.');
                                return;
                              }
                              const exists = customClientOptions.some(
                                (option) => option.toLowerCase() === formatted.toLowerCase()
                              );
                              if (exists) {
                                setCustomClientValidationError(`${formatted} is already in the list.`);
                                return;
                              }
                              setCustomClientOptions((prev) => [...prev, formatted]);
                              setCustomClientSelections((prev) => [...prev, formatted]);
                              setCustomCategoryInput('');
                              setIsAddingCustomCategory(false);
                              setCustomClientValidationError(null);
                            }}
                            className="h-9"
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsAddingCustomCategory(false);
                              setCustomCategoryInput('');
                              setCustomClientValidationError(null);
                            }}
                            className="h-9"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto px-0 py-1 text-xs font-medium"
                        onClick={() => {
                          setIsAddingCustomCategory(true);
                          setCustomCategoryInput('');
                        }}
                      >
                        + Add another material
                      </Button>
                    )}
                    {customClientValidationError && (
                      <p className="text-xs font-medium text-destructive flex items-center gap-1">
                        <span className="inline-block w-1 h-1 rounded-full bg-destructive"></span>
                        {customClientValidationError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Store Name Label */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="storeName" className="text-right">
                  {getLabelForStoreName(customerData.clientType || 'Dealer')} *
                </Label>
                <Input id="storeName" value={customerData.storeName || ''} className="col-span-3" onChange={(e) => handleInputChange('storeName', e.target.value)} />
              </div>

              {/* Dynamic Owner Name Label */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="clientFirstName" className="text-right">
                  {getLabelForOwner(customerData.clientType || 'Dealer')} First Name *
                </Label>
                <Input id="clientFirstName" value={customerData.clientFirstName || ''} className="col-span-3" onChange={(e) => handleInputChange('clientFirstName', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="clientLastName" className="text-right">
                  {getLabelForOwner(customerData.clientType || 'Dealer')} Last Name
                </Label>
                <Input id="clientLastName" value={customerData.clientLastName || ''} className="col-span-3" onChange={(e) => handleInputChange('clientLastName', e.target.value)} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="contact" className="mt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="primaryContact" className="text-right">
                  Primary Contact <span className="text-red-500">*</span>
                </Label>
                <div className="col-span-3 space-y-1">
                  <Input 
                    id="primaryContact" 
                    type="tel" 
                    value={customerData.primaryContact || ''} 
                    onChange={(e) => handlePhoneChange('primaryContact', e.target.value)}
                    maxLength={10}
                    placeholder="10 digit phone number"
                    className={primaryContactError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {primaryContactError && (
                    <p className="text-xs text-red-500 mt-1">{primaryContactError}</p>
                  )}
                  {customerData.primaryContact && !primaryContactError && (
                    <p className="text-xs text-green-600 mt-1">✓ Valid phone number</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="secondaryContact" className="text-right">
                  Secondary Contact
                </Label>
                <div className="col-span-3 space-y-1">
                  <Input 
                    id="secondaryContact" 
                    type="tel" 
                    value={customerData.secondaryContact || ''} 
                    onChange={(e) => handlePhoneChange('secondaryContact', e.target.value)}
                    maxLength={10}
                    placeholder="10 digit phone number"
                    className={secondaryContactError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {secondaryContactError && (
                    <p className="text-xs text-red-500 mt-1">{secondaryContactError}</p>
                  )}
                  {customerData.secondaryContact && !secondaryContactError && (
                    <p className="text-xs text-green-600 mt-1">✓ Valid phone number</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input id="email" type="email" value={customerData.email || ''} className="col-span-3" onChange={(e) => handleInputChange('email', e.target.value)} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="address" className="mt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="addressLine1" className="text-right">
                  Address Line 1
                </Label>
                <Input id="addressLine1" value={customerData.addressLine1 || ''} className="col-span-3" onChange={(e) => handleInputChange('addressLine1', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="addressLine2" className="text-right">
                  Address Line 2
                </Label>
                <Input id="addressLine2" value={customerData.addressLine2 || ''} className="col-span-3" onChange={(e) => handleInputChange('addressLine2', e.target.value)} />
              </div>
              
              {/* District Dropdown */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="district" className="text-right">
                  District
                </Label>
                <div className="col-span-3 space-y-2">
                  <Select
                    value={selectedDistrictId?.toString() || ''}
                    onValueChange={(value) => {
                      const districtId = parseInt(value);
                      setSelectedDistrictId(districtId);
                      const selectedDistrict = districts.find(d => d.id === districtId);
                      if (selectedDistrict) {
                        handleInputChange('district', selectedDistrict.districtName);
                      }
                      setDistrictSearch(''); // Reset search on selection
                    }}
                    disabled={!selectedStateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedStateId ? "Select state below first" : "Select district"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="sticky top-0 bg-background p-2 border-b">
                        <Input
                          placeholder="Search district..."
                          value={districtSearch}
                          onChange={(e) => setDistrictSearch(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {filteredDistricts.length > 0 ? (
                          filteredDistricts.map((district) => (
                            <SelectItem key={district.id} value={district.id.toString()}>
                              {district.districtName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            No district found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                  {!selectedStateId && (
                    <p className="text-xs text-muted-foreground">
                      Select a state below to load available districts.
                    </p>
                  )}
                </div>
              </div>

              {/* State Dropdown */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="state" className="text-right">
                  State <span className="text-red-500">*</span>
                </Label>
                <div className="col-span-3">
                  <Select
                    value={selectedStateId?.toString() || ''}
                    onValueChange={(value) => {
                      const stateId = parseInt(value);
                      setSelectedStateId(stateId);
                      const selectedState = states.find(s => s.id === stateId);
                      if (selectedState) {
                        handleInputChange('state', selectedState.stateName);
                      }
                      setStateSearch(''); // Reset search on selection
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="sticky top-0 bg-background p-2 border-b">
                        <Input
                          placeholder="Search state..."
                          value={stateSearch}
                          onChange={(e) => setStateSearch(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {filteredStates.length > 0 ? (
                          filteredStates.map((state) => (
                            <SelectItem key={state.id} value={state.id.toString()}>
                              {state.stateName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            No state found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sub-District Dropdown */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="subDistrict" className="text-right">
                  Sub-District
                </Label>
                <div className="col-span-3">
                  <Select
                    value={selectedSubDistrictId?.toString() || ''}
                    onValueChange={(value) => {
                      const subDistrictId = parseInt(value);
                      setSelectedSubDistrictId(subDistrictId);
                      const selectedSubDistrict = subDistricts.find(sd => sd.id === subDistrictId);
                      if (selectedSubDistrict) {
                        handleInputChange('subDistrict', selectedSubDistrict.subDistrictName);
                      }
                      setSubDistrictSearch(''); // Reset search on selection
                    }}
                    disabled={!selectedDistrictId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedDistrictId ? "Select district first" : "Select sub-district"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="sticky top-0 bg-background p-2 border-b">
                        <Input
                          placeholder="Search sub-district..."
                          value={subDistrictSearch}
                          onChange={(e) => setSubDistrictSearch(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {filteredSubDistricts.length > 0 ? (
                          filteredSubDistricts.map((subDistrict) => (
                            <SelectItem key={subDistrict.id} value={subDistrict.id.toString()}>
                              {subDistrict.subDistrictName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            No sub-district found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* City Dropdown */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="city" className="text-right">
                  City <span className="text-red-500">*</span>
                </Label>
                <div className="col-span-3">
                  <Select
                    value={customerData.city || ''}
                    onValueChange={(value) => {
                      handleInputChange('city', value);
                      setCitySearch(''); // Reset search on selection
                    }}
                    disabled={!selectedSubDistrictId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedSubDistrictId ? "Select sub-district first" : "Select city"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="sticky top-0 bg-background p-2 border-b">
                        <Input
                          placeholder="Search city..."
                          value={citySearch}
                          onChange={(e) => setCitySearch(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {filteredCities.length > 0 ? (
                          filteredCities.map((city) => (
                            <SelectItem key={city.id} value={city.cityName}>
                              {city.cityName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            No city found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="country" className="text-right">
                  Country
                </Label>
                <Input id="country" value={customerData.country || 'India'} className="col-span-3" onChange={(e) => handleInputChange('country', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="pincode" className="text-right">
                  Pincode
                </Label>
                <Input id="pincode" type="number" value={customerData.pincode || ''} className="col-span-3" onChange={(e) => handleInputChange('pincode', e.target.value)} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="additional" className="mt-4">
            <div className="grid gap-4">
              {/* Common Fields */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="gstNumber" className="text-right">
                  GST Number
                </Label>
                <Input id="gstNumber" value={customerData.gstNumber || ''} className="col-span-3" onChange={(e) => handleInputChange('gstNumber', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="monthlySale" className="text-right">
                  Monthly Sale
                </Label>
                <Input id="monthlySale" type="number" value={customerData.monthlySale || ''} className="col-span-3" onChange={(e) => handleInputChange('monthlySale', e.target.value)} />
              </div>

              {/* GPS Location */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">
                  GPS Location
                </Label>
                <div className="col-span-3 flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="flex-1"
                  >
                    {isGettingLocation ? 'Getting Location...' : 'Get Current Location'}
                  </Button>
                  <Input 
                    placeholder="Latitude" 
                    value={customerData.latitude || ''} 
                    onChange={(e) => handleInputChange('latitude', parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <Input 
                    placeholder="Longitude" 
                    value={customerData.longitude || ''} 
                    onChange={(e) => handleInputChange('longitude', parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                </div>
              </div>


              {/* Dealer/Shop Specific Fields */}
              {customerData.clientType === 'Dealer' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-3">Dealer/Shop Details</h4>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="shopAgeYears" className="text-right">
                      Shop Age (Years)
                    </Label>
                    <Input id="shopAgeYears" type="number" value={customerData.shopAgeYears || ''} className="col-span-3" onChange={(e) => handleInputChange('shopAgeYears', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ownershipType" className="text-right">
                      Ownership Type
                    </Label>
                    <Select value={customerData.ownershipType || ''} onValueChange={(value) => handleInputChange('ownershipType', value)}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select ownership type" />
                      </SelectTrigger>
                      <SelectContent>
                        {OWNERSHIP_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dealerType" className="text-right">
                      Dealer Type
                    </Label>
                    <Select value={customerData.dealerType || ''} onValueChange={(value) => {
                      handleInputChange('dealerType', value);
                      // If dealer type is ICON, automatically set sub-type to EXCLUSIVE
                      if (value === 'ICON') {
                        handleInputChange('dealerSubType', 'EXCLUSIVE');
                      }
                    }}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select dealer type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEALER_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dealerSubType" className="text-right">
                      Dealer Sub-Type
                    </Label>
                    <Select value={customerData.dealerSubType || ''} onValueChange={(value) => handleInputChange('dealerSubType', value)}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select dealer sub-type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEALER_SUB_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Professional (Engineer/Architect/Contractor) Specific Fields */}
              {customerData.clientType === 'Professional' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-3">Professional Details</h4>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dateOfBirth" className="text-right">
                      Date of Birth
                    </Label>
                    <Input id="dateOfBirth" type="date" value={customerData.dateOfBirth || ''} className="col-span-3" onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="yearsOfExperience" className="text-right">
                      Years of Experience
                    </Label>
                    <Input id="yearsOfExperience" value={customerData.yearsOfExperience || ''} className="col-span-3" onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)} />
                  </div>
                </>
              )}

              {/* Site Visit Specific Fields */}
              {customerData.clientType === 'Site Visit' && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-3">Site Visit Details</h4>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="contractorName" className="text-right">
                      Contractor Name
                    </Label>
                    <Input id="contractorName" value={customerData.contractorName || ''} className="col-span-3" onChange={(e) => handleInputChange('contractorName', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="engineerName" className="text-right">
                      Engineer Name
                    </Label>
                    <Input id="engineerName" value={customerData.engineerName || ''} className="col-span-3" onChange={(e) => handleInputChange('engineerName', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="projectType" className="text-right">
                      Project Type
                    </Label>
                    <Select value={customerData.projectType || ''} onValueChange={(value) => handleInputChange('projectType', value)}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="projectSizeSquareFeet" className="text-right">
                      Project Size (sq ft)
                    </Label>
                    <Input id="projectSizeSquareFeet" type="number" value={customerData.projectSizeSquareFeet || ''} className="col-span-3" onChange={(e) => handleInputChange('projectSizeSquareFeet', e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {activeTab !== 'basic' && (
            <Button variant="outline" onClick={handlePrevious}>
              Previous
            </Button>
          )}
          {activeTab !== 'additional' ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSubmit}>Add Customer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerModal;
