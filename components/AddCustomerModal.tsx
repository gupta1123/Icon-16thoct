"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ProfessionalSelector } from '@/components/ProfessionalSelector';
import { API, getStock, type StateDto, type DistrictDto, type SubDistrictDto, type CityDto, type ProfessionalDto } from '@/lib/api';
import { 
  UserPlus, 
  ChevronRight, 
  ChevronLeft, 
  MapPin, 
  Check, 
  Plus, 
  AlertCircle, 
  Building2, 
  User, 
  Briefcase, 
  Phone, 
  Mail, 
  Crosshair, 
  HardHat, 
  UserCheck, 
  FileText,
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';

const ADDITIONAL_INFO_DEFAULT_OPTIONS = ['Structure', 'Tiles', 'Pipes', 'Paints', 'Adhesives'] as const;

// Customer type options with visual metadata
const CUSTOMER_TYPES = [
  { 
    value: 'Dealer', 
    label: 'Dealer / Shop', 
    desc: 'Retailer or wholesale distributor',
    icon: Building2 
  },
  { 
    value: 'Professional', 
    label: 'Professional', 
    desc: 'Engineer, Architect or Contractor',
    icon: UserCheck 
  },
  { 
    value: 'Site Visit', 
    label: 'Site Project', 
    desc: 'Construction site or project',
    icon: HardHat 
  },
];

const PROJECT_TYPES = [
  { value: 'HOME', label: 'Home' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'GOVT_PROJECT', label: 'Government Project' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'OTHERS', label: 'Others' }
];

const OWNERSHIP_TYPES = [
  { value: 'OWNED', label: 'Owned' },
  { value: 'RENTED', label: 'Rented' }
];

const DEALER_TYPES = [
  { value: 'ICON', label: 'ICON' },
  { value: 'NON_ICON', label: 'Non-ICON' }
];

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
  stock?: string | number;
  monthlySale?: string | number;
  clientType?: string;
  
  shopAgeYears?: number;
  ownershipType?: string;
  dealerType?: string;
  dealerSubType?: string;
  
  dateOfBirth?: string;
  yearsOfExperience?: string;
  
  contractorName?: string;
  contractorId?: number | null;
  engineerName?: string;
  engineerId?: number | null;
  engineerContact?: string | number | null;
  engineerCity?: string | null;
  projectType?: string;
  projectSizeSquareFeet?: number;
  
  latitude?: number;
  longitude?: number;

  additionalInfo?: string;
  productCategory?: string | string[] | null;
  productCategories?: string[] | null;
}

const formatAdditionalCategory = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const decodeAdditionalInfo = (raw?: string | null): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map(formatAdditionalCategory)
    .filter(Boolean);
};

const toApiCategory = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
};

const isEngineerProfessional = (professional: ProfessionalDto): boolean => {
  return (professional.role ?? '').toLowerCase().includes('engineer');
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
  const extractInitialCategories = useCallback((data?: CustomerData): string[] => {
    if (!data) return [];
    const categories = new Set<string>();
    const addFromValue = (value: unknown) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string') {
            const formatted = formatAdditionalCategory(item);
            if (formatted) categories.add(formatted);
          }
        });
      } else if (typeof value === 'string') {
        decodeAdditionalInfo(value).forEach((item) => {
          const formatted = formatAdditionalCategory(item);
          if (formatted) categories.add(formatted);
        });
      }
    };

    addFromValue(data.productCategories);
    addFromValue((data as Record<string, unknown>)?.productCategory);
    addFromValue(data.additionalInfo);
    return Array.from(categories);
  }, []);

  const initialAdditionalSelections = useMemo(
    () => extractInitialCategories(existingData),
    [existingData, extractInitialCategories]
  );
  const existingDataRef = useRef<CustomerData | undefined>(existingData);
  existingDataRef.current = existingData;
  const originalCategoriesRef = useRef<string[]>(initialAdditionalSelections);
  const [clientNameInput, setClientNameInput] = useState('');

  const [customerData, setCustomerData] = useState<CustomerData>(
    existingData
      ? {
          ...existingData,
          stock: getStock(existingData) ?? undefined,
          additionalInfo: existingData.additionalInfo ?? '',
          productCategories: initialAdditionalSelections,
        }
      : {
          clientFirstName: '',
          clientLastName: '',
          email: '',
          clientType: 'Dealer',
          additionalInfo: '',
          productCategories: [],
        }
  );

  const [additionalInfoOptions, setAdditionalInfoOptions] = useState<string[]>(() => {
    const base = Array.from(ADDITIONAL_INFO_DEFAULT_OPTIONS);
    if (initialAdditionalSelections.length === 0) return base;
    return Array.from(new Set([...base, ...initialAdditionalSelections]));
  });
  const [additionalInfoSelections, setAdditionalInfoSelections] = useState<string[]>(initialAdditionalSelections);
  const [isAddingAdditionalInfo, setIsAddingAdditionalInfo] = useState(false);
  const [additionalInfoInput, setAdditionalInfoInput] = useState('');
  const [additionalInfoValidationError, setAdditionalInfoValidationError] = useState<string | null>(null);

  const applyAdditionalSelections = useCallback((nextSelections: string[]) => {
    const normalized = nextSelections
      .map(formatAdditionalCategory)
      .filter(Boolean);
    const unique = Array.from(new Set(normalized));
    setAdditionalInfoSelections(unique);
    setCustomerData((prev) => ({
      ...prev,
      additionalInfo: unique.join(', '),
      productCategories: unique,
    }));
    setAdditionalInfoValidationError(null);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const currentExisting = existingDataRef.current;
    const selections = extractInitialCategories(currentExisting);

    if (currentExisting) {
      setCustomerData({
        ...currentExisting,
        stock: getStock(currentExisting) ?? undefined,
        additionalInfo: currentExisting.additionalInfo ?? '',
        productCategories: selections,
      });
      const fullName = `${currentExisting.clientFirstName ?? ''} ${currentExisting.clientLastName ?? ''}`.trim();
      setClientNameInput(fullName);
      setAdditionalInfoOptions(() => {
        const base = Array.from(ADDITIONAL_INFO_DEFAULT_OPTIONS);
        return Array.from(new Set([...base, ...selections]));
      });
      applyAdditionalSelections(selections);
      originalCategoriesRef.current = selections;
    } else {
      setCustomerData({
        clientFirstName: '',
        clientLastName: '',
        email: '',
        clientType: 'Dealer',
        additionalInfo: '',
        productCategories: [],
      });
      setClientNameInput('');
      setAdditionalInfoOptions(Array.from(ADDITIONAL_INFO_DEFAULT_OPTIONS));
      applyAdditionalSelections([]);
      originalCategoriesRef.current = [];
    }

    setIsAddingAdditionalInfo(false);
    setAdditionalInfoInput('');
    setAdditionalInfoValidationError(null);
  }, [isOpen, existingData?.id, applyAdditionalSelections, extractInitialCategories]);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  
  const [primaryContactError, setPrimaryContactError] = useState<string>('');
  const [secondaryContactError, setSecondaryContactError] = useState<string>('');
  
  const [states, setStates] = useState<StateDto[]>([]);
  const [districts, setDistricts] = useState<DistrictDto[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrictDto[]>([]);
  const [cities, setCities] = useState<CityDto[]>([]);
  
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [selectedSubDistrictId, setSelectedSubDistrictId] = useState<number | null>(null);
  
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [subDistrictSearch, setSubDistrictSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [professionals, setProfessionals] = useState<ProfessionalDto[]>([]);
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false);
  const [professionalsError, setProfessionalsError] = useState<string | null>(null);

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

  const engineerOptions = useMemo(
    () => professionals.filter(isEngineerProfessional),
    [professionals]
  );

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const statesData = await API.getAllStates();
        setStates(statesData);
      } catch (error) {
        console.error('Error fetching states:', error);
        setStates([]);
      }
    };
    fetchStates();
  }, []);

  useEffect(() => {
    if (!isOpen || customerData.clientType !== 'Site Visit' || !token) return;

    let isCancelled = false;
    const fetchProfessionals = async () => {
      try {
        setIsLoadingProfessionals(true);
        setProfessionalsError(null);
        const professionalsData = await API.getAllProfessionals();
        if (!isCancelled) {
          setProfessionals(professionalsData);
        }
      } catch (error) {
        console.error('Error fetching professionals:', error);
        if (!isCancelled) {
          setProfessionals([]);
          setProfessionalsError('Unable to load engineers');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProfessionals(false);
        }
      }
    };

    fetchProfessionals();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, customerData.clientType, token]);

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
      } catch (error) {
        console.error('Error fetching districts:', error);
        setDistricts([]);
      }
    };

    fetchDistricts();
  }, [selectedStateId]);

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
      } catch (error) {
        console.error('Error fetching sub-districts:', error);
        setSubDistricts([]);
      }
    };

    fetchSubDistricts();
  }, [selectedDistrictId]);

  useEffect(() => {
    const fetchCities = async () => {
      if (!selectedSubDistrictId) {
        setCities([]);
        return;
      }

      try {
        const citiesData = await API.getCitiesBySubDistrictId(selectedSubDistrictId);
        setCities(citiesData);
      } catch (error) {
        console.error('Error fetching cities:', error);
        setCities([]);
      }
    };

    fetchCities();
  }, [selectedSubDistrictId]);

  const handlePhoneChange = (field: 'primaryContact' | 'secondaryContact', value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    const limitedValue = digitsOnly.slice(0, 10);
    
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
    
    setCustomerData((prevData) => ({
      ...prevData,
      [field]: limitedValue === '' ? '' : limitedValue,
    }));
  };

  const handleInputChange = (field: keyof CustomerData, value: string | number) => {
    if (field === 'clientType') {
      const newClientType = typeof value === 'string' ? value : String(value);
      if (newClientType !== 'Dealer' && customerData.clientType === 'Dealer') {
        applyAdditionalSelections([]);
      }
      setCustomerData((prevData) => ({
        ...prevData,
        clientType: newClientType,
      }));
      return;
    }

    if (field === 'additionalInfo') {
      const stringValue = typeof value === 'string' ? value : value.toString();
      const selections = decodeAdditionalInfo(stringValue);
      applyAdditionalSelections(selections);
      return;
    }

    let parsedValue: string | number = value;
    const numberFields: (keyof CustomerData)[] = ['pincode', 'stock', 'monthlySale', 'shopAgeYears', 'projectSizeSquareFeet'];
    if (numberFields.includes(field)) {
      parsedValue = value === '' ? '' : parseInt(value.toString(), 10);
    }

    setCustomerData((prevData) => ({
      ...prevData,
      [field]: parsedValue,
    }));
  };

  const handleEngineerSelect = (engineer: ProfessionalDto | null) => {
    setCustomerData((prevData) => ({
      ...prevData,
      engineerId: engineer?.id,
      engineerName: engineer?.name ?? '',
      engineerContact: engineer?.contact ?? null,
      engineerCity: engineer?.city ?? null,
    }));
  };

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
        maximumAge: 300000,
      }
    );
  };

  const getLabelForStoreName = (clientType: string): string => {
    switch (clientType) {
      case 'Dealer': return 'Shop / Store Name';
      case 'Professional': return 'Firm Name';
      case 'Site Visit': return 'Project Name';
      default: return 'Business Name';
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitError(null);
      
      if (primaryContactError || secondaryContactError) {
        setSubmitError('Please fix phone number errors before submitting');
        return;
      }
      
      const primaryContactStr = customerData.primaryContact?.toString() || '';
      if (primaryContactStr.length > 0 && primaryContactStr.length !== 10) {
        setPrimaryContactError('Phone number must be 10 digits');
        setSubmitError('Primary contact must be exactly 10 digits');
        return;
      }
      
      const secondaryContactStr = customerData.secondaryContact?.toString() || '';
      if (secondaryContactStr.length > 0 && secondaryContactStr.length !== 10) {
        setSecondaryContactError('Phone number must be 10 digits');
        setSubmitError('Secondary contact must be exactly 10 digits');
        return;
      }
      
      const requiredFields: Array<[keyof CustomerData, string]> = [
        ['storeName', 'Store Name'],
        ['clientFirstName', 'Name'],
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
        setSubmitError(`Required fields missing: ${missing.join(', ')}`);
        return;
      }

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

      const additionalInfoValue = (() => {
        if (customerData.clientType !== 'Dealer') {
          return undefined;
        }
        if (additionalInfoSelections.length > 0) {
          return additionalInfoSelections.join(', ');
        }
        const fallback = customerData.additionalInfo?.toString().trim() ?? '';
        return fallback || undefined;
      })();

      const apiCategories = customerData.clientType === 'Dealer' 
        ? additionalInfoSelections.map(toApiCategory)
        : [];

      const isEditing = Boolean(existingData && existingData.id);
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/edit?id=${existingData?.id}`
        : 'https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/create';

      const stockValue = cleanDigits(customerData.stock ?? customerData.monthlySale);

      const requestBody = {
        ...customerData,
        clientType: customerData.clientType,
        additionalInfo: additionalInfoValue,
        primaryContact: cleanDigits(customerData.primaryContact),
        secondaryContact: cleanDigits(customerData.secondaryContact),
        pincode: cleanDigits(customerData.pincode),
        stock: stockValue,
        monthlySale: stockValue,
        shopAgeYears: customerData.shopAgeYears ? parseInt(customerData.shopAgeYears.toString(), 10) : undefined,
        projectSizeSquareFeet: customerData.projectSizeSquareFeet ? parseFloat(customerData.projectSizeSquareFeet.toString()) : undefined,
        latitude: customerData.latitude || null,
        longitude: customerData.longitude || null,
        employeeId: employeeId || null,
      };

      (requestBody as Record<string, unknown>).dealerSubType =
        customerData.dealerType === 'ICON' ? customerData.dealerSubType : undefined;
      (requestBody as Record<string, unknown>).productCategories =
        customerData.clientType === 'Dealer' && !isEditing && apiCategories.length > 0 ? apiCategories : undefined;
      (requestBody as Record<string, unknown>).productCategory = undefined;

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        if (existingData && existingData.id && customerData.clientType === 'Dealer') {
          const previousCategories = originalCategoriesRef.current.map(toApiCategory);
          const currentCategories = apiCategories;
          const categoriesToAdd = currentCategories.filter(
            (category) => !previousCategories.includes(category)
          );
          const categoriesToRemove = previousCategories.filter(
            (category) => !currentCategories.includes(category)
          );

          try {
            if (categoriesToAdd.length > 0) {
              const addResponse = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/addCategories', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  storeId: existingData.id,
                  categories: categoriesToAdd,
                }),
              });
              if (!addResponse.ok) {
                const errorMessage = await addResponse.text();
                throw new Error(errorMessage || 'Failed to add categories');
              }
            }

            if (categoriesToRemove.length > 0) {
              const removeResponse = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/removeCategories', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  storeId: existingData.id,
                  categories: categoriesToRemove,
                }),
              });
              if (!removeResponse.ok) {
                const errorMessage = await removeResponse.text();
                throw new Error(errorMessage || 'Failed to remove categories');
              }
            }

            originalCategoriesRef.current = additionalInfoSelections;
          } catch (categoryError) {
            console.error('Error updating product categories:', categoryError);
            const message =
              categoryError instanceof Error
                ? categoryError.message
                : 'Failed to update product categories';
            setSubmitError(message);
            return;
          }
        }

        onClose();
        if (onCustomerAdded) {
          onCustomerAdded();
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to update/create customer', response.status, errorText);
        setSubmitError(errorText || 'Failed to update/create customer');
      }
    } catch (error) {
      console.error('Error updating/creating customer:', error);
      setSubmitError('Unexpected error while saving customer');
    }
  };

  const steps = [
    { number: 1, title: 'Profile', subtitle: 'Type & Identity' },
    { number: 2, title: 'Contact', subtitle: 'Phone & Email' },
    { number: 3, title: 'Location', subtitle: 'Address & City' },
    { number: 4, title: 'Details', subtitle: 'Specs & GPS' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] rounded-2xl border border-border/80 bg-background shadow-2xl p-0 overflow-hidden text-foreground">
        
        {/* Sleek Top Header Bar */}
        <div className="px-6 pt-5 pb-4 border-b border-border/40 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold shadow-xs shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground leading-snug">
                  {existingData ? 'Edit Customer Record' : 'Create New Customer'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Step {currentStep} of 4 &bull; {steps[currentStep - 1].subtitle}
                </p>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress Bar & Step Indicators */}
          <div className="mt-4 space-y-2">
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-foreground transition-all duration-300 ease-out" 
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-1 pt-1">
              {steps.map((s) => {
                const isActive = s.number === currentStep;
                const isDone = s.number < currentStep;
                return (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => setCurrentStep(s.number)}
                    className={`text-left transition-all ${
                      isActive 
                        ? 'text-foreground font-bold' 
                        : isDone 
                        ? 'text-muted-foreground font-medium hover:text-foreground' 
                        : 'text-muted-foreground/60 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs truncate">
                      <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] ${
                        isActive ? 'bg-foreground text-background font-bold' : isDone ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        {isDone ? '✓' : s.number}
                      </span>
                      <span className="truncate">{s.title}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 min-h-[380px] max-h-[70vh] overflow-y-auto space-y-5">
          {submitError && (
            <div className="rounded-xl border border-border bg-muted p-3 text-xs text-foreground font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-foreground" />
              <span>{submitError}</span>
            </div>
          )}

          {/* STEP 1: TYPE & PROFILE */}
          {currentStep === 1 && (
            <div className="space-y-5">
              {/* Customer Type Cards */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground block">
                  Select Customer Category *
                </Label>
                <div className="grid grid-cols-3 gap-2.5">
                  {CUSTOMER_TYPES.map((type) => {
                    const IconComp = type.icon;
                    const isSelected = (customerData.clientType || 'Dealer') === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleInputChange('clientType', type.value)}
                        className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-2 border-foreground bg-foreground text-background shadow-md shadow-foreground/5 scale-[1.01]'
                            : 'border-border/70 bg-card text-foreground hover:border-foreground/40 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-background/20 text-background' : 'bg-muted text-foreground'}`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-background shrink-0" />}
                        </div>
                        <div>
                          <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-background' : 'text-foreground'}`}>
                            {type.label}
                          </p>
                          <p className={`text-[10px] mt-0.5 leading-tight line-clamp-1 ${isSelected ? 'text-background/80' : 'text-muted-foreground'}`}>
                            {type.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="storeName" className="text-xs font-semibold text-foreground">
                    {getLabelForStoreName(customerData.clientType || 'Dealer')} *
                  </Label>
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input 
                      id="storeName" 
                      value={customerData.storeName || ''} 
                      className="h-10 text-xs pl-9 rounded-xl border-border/80 bg-card" 
                      placeholder="e.g. Icon Steel Trading Co."
                      onChange={(e) => handleInputChange('storeName', e.target.value)} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="clientName" className="text-xs font-semibold text-foreground">
                    Owner / Contact Person *
                  </Label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input 
                      id="clientName" 
                      value={clientNameInput}
                      className="h-10 text-xs pl-9 rounded-xl border-border/80 bg-card" 
                      placeholder="Full name"
                      onChange={(e) => {
                        const fullName = e.target.value;
                        setClientNameInput(fullName);
                        const trimmed = fullName.trim();
                        if (!trimmed) {
                          setCustomerData((prevData) => ({
                            ...prevData,
                            clientFirstName: '',
                            clientLastName: '',
                          }));
                          return;
                        }
                        const nameParts = trimmed.split(/\s+/);
                        const firstName = nameParts[0] || '';
                        const lastName = nameParts.slice(1).join(' ');
                        setCustomerData((prevData) => ({
                          ...prevData,
                          clientFirstName: firstName,
                          clientLastName: lastName,
                        }));
                      }} 
                    />
                  </div>
                </div>
              </div>

              {/* Product Category Chips - Dealer only */}
              {customerData.clientType === 'Dealer' && (
                <div className="space-y-2.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      Product Tagging & Mix
                    </Label>
                    <span className="text-[11px] text-muted-foreground">Select dealer products</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {additionalInfoOptions.map((option) => {
                      const normalized = formatAdditionalCategory(option);
                      const isChecked = additionalInfoSelections.includes(normalized);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            const next = isChecked
                              ? additionalInfoSelections.filter((item) => item !== normalized)
                              : [...additionalInfoSelections, normalized];
                            applyAdditionalSelections(next);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isChecked
                              ? 'bg-foreground text-background shadow-xs scale-[1.02]'
                              : 'bg-muted/60 text-foreground border border-border/70 hover:border-foreground/40'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>

                  {isAddingAdditionalInfo ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={additionalInfoInput}
                        onChange={(e) => setAdditionalInfoInput(e.target.value)}
                        placeholder="New category tag"
                        className="h-8 text-xs flex-1 rounded-lg border-border"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const formatted = formatAdditionalCategory(additionalInfoInput);
                          if (!formatted) return;
                          setAdditionalInfoOptions((prev) => [...prev, formatted]);
                          applyAdditionalSelections([...additionalInfoSelections, formatted]);
                          setAdditionalInfoInput('');
                          setIsAddingAdditionalInfo(false);
                        }}
                        className="h-8 text-xs font-bold px-3 rounded-lg bg-foreground text-background"
                      >
                        Add Tag
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsAddingAdditionalInfo(false)}
                        className="h-8 text-xs px-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingAdditionalInfo(true)}
                      className="text-[11px] font-bold text-foreground hover:underline flex items-center gap-1 pt-1"
                    >
                      <Plus className="w-3 h-3" /> Add Custom Category
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CONTACT */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="primaryContact" className="text-xs font-semibold text-foreground">
                    Primary Phone Number *
                  </Label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input 
                      id="primaryContact" 
                      type="tel" 
                      value={customerData.primaryContact || ''} 
                      onChange={(e) => handlePhoneChange('primaryContact', e.target.value)}
                      maxLength={10}
                      placeholder="10 digit mobile number"
                      className={`h-10 text-xs pl-9 rounded-xl border-border/80 bg-card ${primaryContactError ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {primaryContactError && (
                    <p className="text-xs text-destructive">{primaryContactError}</p>
                  )}
                  {customerData.primaryContact && !primaryContactError && (
                    <p className="text-[11px] text-foreground font-medium flex items-center gap-1">
                      <Check className="w-3 h-3 text-foreground" /> Valid 10-digit number
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="secondaryContact" className="text-xs font-semibold text-foreground">
                    Secondary Phone (Optional)
                  </Label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input 
                      id="secondaryContact" 
                      type="tel" 
                      value={customerData.secondaryContact || ''} 
                      onChange={(e) => handlePhoneChange('secondaryContact', e.target.value)}
                      maxLength={10}
                      placeholder="Alternate mobile number"
                      className={`h-10 text-xs pl-9 rounded-xl border-border/80 bg-card ${secondaryContactError ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {secondaryContactError && (
                    <p className="text-xs text-destructive">{secondaryContactError}</p>
                  )}
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      value={customerData.email || ''} 
                      className="h-10 text-xs pl-9 rounded-xl border-border/80 bg-card" 
                      placeholder="business@domain.com"
                      onChange={(e) => handleInputChange('email', e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION & ADDRESS */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addressLine1" className="text-xs font-semibold text-foreground">
                    Address Line 1
                  </Label>
                  <Input 
                    id="addressLine1" 
                    value={customerData.addressLine1 || ''} 
                    className="h-10 text-xs rounded-xl border-border/80 bg-card" 
                    placeholder="Shop/Building #, Street name"
                    onChange={(e) => handleInputChange('addressLine1', e.target.value)} 
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addressLine2" className="text-xs font-semibold text-foreground">
                    Address Line 2
                  </Label>
                  <Input 
                    id="addressLine2" 
                    value={customerData.addressLine2 || ''} 
                    className="h-10 text-xs rounded-xl border-border/80 bg-card" 
                    placeholder="Area, Landmark or Industrial Zone"
                    onChange={(e) => handleInputChange('addressLine2', e.target.value)} 
                  />
                </div>

                {/* State Dropdown */}
                <div className="space-y-1.5">
                  <Label htmlFor="state" className="text-xs font-semibold text-foreground">
                    State *
                  </Label>
                  <Select
                    value={selectedStateId?.toString() || ''}
                    onValueChange={(value) => {
                      const stateId = parseInt(value);
                      setSelectedStateId(stateId);
                      const selectedState = states.find(s => s.id === stateId);
                      if (selectedState) {
                        handleInputChange('state', selectedState.stateName);
                      }
                      setStateSearch('');
                    }}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-card">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px] rounded-xl">
                      <div className="sticky top-0 bg-background p-2 border-b">
                        <Input
                          placeholder="Search state..."
                          value={stateSearch}
                          onChange={(e) => setStateSearch(e.target.value)}
                          className="h-8 text-xs"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-[160px] overflow-y-auto">
                        {filteredStates.map((state) => (
                          <SelectItem key={state.id} value={state.id.toString()} className="text-xs">
                            {state.stateName}
                          </SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                {/* District Dropdown */}
                <div className="space-y-1.5">
                  <Label htmlFor="district" className="text-xs font-semibold text-foreground">
                    District
                  </Label>
                  <Select
                    value={selectedDistrictId?.toString() || ''}
                    onValueChange={(value) => {
                      const districtId = parseInt(value);
                      setSelectedDistrictId(districtId);
                      const selectedDistrict = districts.find(d => d.id === districtId);
                      if (selectedDistrict) {
                        handleInputChange('district', selectedDistrict.districtName);
                      }
                      setDistrictSearch('');
                    }}
                    disabled={!selectedStateId}
                  >
                    <SelectTrigger className="h-10 text-xs rounded-xl border-border/80 bg-card">
                      <SelectValue placeholder={!selectedStateId ? "Select state first" : "Select district"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px] rounded-xl">
                      <div className="sticky top-0 bg-background p-2 border-b">
                        <Input
                          placeholder="Search district..."
                          value={districtSearch}
                          onChange={(e) => setDistrictSearch(e.target.value)}
                          className="h-8 text-xs"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="max-h-[160px] overflow-y-auto">
                        {filteredDistricts.map((district) => (
                          <SelectItem key={district.id} value={district.id.toString()} className="text-xs">
                            {district.districtName}
                          </SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub-District Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="subDistrict" className="text-xs font-semibold text-foreground">
                    Sub-District / Tehsil
                  </Label>
                  <Input 
                    id="subDistrict" 
                    value={customerData.subDistrict || ''} 
                    className="h-10 text-xs rounded-xl border-border/80 bg-card" 
                    placeholder="Enter sub-district"
                    onChange={(e) => handleInputChange('subDistrict', e.target.value)} 
                  />
                </div>

                {/* City Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-xs font-semibold text-foreground">
                    City *
                  </Label>
                  <Input 
                    id="city" 
                    value={customerData.city || ''} 
                    className="h-10 text-xs rounded-xl border-border/80 bg-card" 
                    placeholder="City name"
                    onChange={(e) => handleInputChange('city', e.target.value)} 
                  />
                </div>

                {/* Pincode & Country */}
                <div className="space-y-1.5">
                  <Label htmlFor="pincode" className="text-xs font-semibold text-foreground">
                    Pincode
                  </Label>
                  <Input 
                    id="pincode" 
                    type="number" 
                    value={customerData.pincode || ''} 
                    className="h-10 text-xs rounded-xl border-border/80 bg-card" 
                    placeholder="6-digit pincode"
                    onChange={(e) => handleInputChange('pincode', e.target.value)} 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs font-semibold text-foreground">
                    Country
                  </Label>
                  <Input 
                    id="country" 
                    value={customerData.country || 'India'} 
                    className="h-10 text-xs rounded-xl border-border/80 bg-card" 
                    onChange={(e) => handleInputChange('country', e.target.value)} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DETAILS & GPS */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gstNumber" className="text-xs font-semibold text-foreground">
                    GSTIN Number
                  </Label>
                  <Input 
                    id="gstNumber" 
                    value={customerData.gstNumber || ''} 
                    className="h-10 text-xs rounded-xl border-border/80 uppercase bg-card" 
                    placeholder="27AAAAA0000A1Z5"
                    onChange={(e) => handleInputChange('gstNumber', e.target.value)} 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="stock" className="text-xs font-semibold text-foreground">
                    Monthly Sales / Capacity (MT)
                  </Label>
                  <Input 
                    id="stock" 
                    type="number" 
                    value={customerData.stock ?? ''} 
                    className="h-10 text-xs rounded-xl border-border/80 bg-card" 
                    placeholder="Metric tonnes"
                    onChange={(e) => handleInputChange('stock', e.target.value)} 
                  />
                </div>
              </div>

              {/* Modern Location Coordinates Card */}
              <div className="p-4 rounded-2xl border border-border/80 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-foreground" />
                    <span className="text-xs font-bold text-foreground">GPS Location Coordinates *</span>
                  </div>

                  <Button 
                    type="button" 
                    size="sm"
                    variant="outline" 
                    onClick={getCurrentLocation}
                    disabled={isGettingLocation}
                    className="h-8 text-xs font-bold rounded-xl border-border/80 hover:bg-foreground hover:text-background gap-1.5 transition-all"
                  >
                    <Crosshair className={`w-3.5 h-3.5 ${isGettingLocation ? 'animate-spin' : ''}`} />
                    {isGettingLocation ? 'Detecting...' : 'Use Live GPS'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Latitude</span>
                    <Input 
                      placeholder="0.000000" 
                      value={customerData.latitude || ''} 
                      onChange={(e) => handleInputChange('latitude', parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs rounded-xl border-border/80 bg-background"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Longitude</span>
                    <Input 
                      placeholder="0.000000" 
                      value={customerData.longitude || ''} 
                      onChange={(e) => handleInputChange('longitude', parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs rounded-xl border-border/80 bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Type-Specific Specs */}
              {customerData.clientType === 'Dealer' && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <p className="text-xs font-bold text-foreground">Dealer Specifications</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Shop Age (Years)</Label>
                      <Input 
                        type="number" 
                        value={customerData.shopAgeYears || ''} 
                        className="h-9 text-xs rounded-xl border-border/80 bg-card" 
                        onChange={(e) => handleInputChange('shopAgeYears', e.target.value)} 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Ownership Type</Label>
                      <Select value={customerData.ownershipType || ''} onValueChange={(value) => handleInputChange('ownershipType', value)}>
                        <SelectTrigger className="h-9 text-xs rounded-xl border-border/80 bg-card">
                          <SelectValue placeholder="Select ownership" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {OWNERSHIP_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value} className="text-xs">{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Dealer Type</Label>
                      <Select value={customerData.dealerType || ''} onValueChange={(value) => {
                        handleInputChange('dealerType', value);
                        if (value === 'ICON') handleInputChange('dealerSubType', 'EXCLUSIVE');
                        else handleInputChange('dealerSubType', '');
                      }}>
                        <SelectTrigger className="h-9 text-xs rounded-xl border-border/80 bg-card">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {DEALER_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value} className="text-xs">{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {customerData.clientType === 'Professional' && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <p className="text-xs font-bold text-foreground">Professional Specifications</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Date of Birth</Label>
                      <Input 
                        type="date" 
                        value={customerData.dateOfBirth || ''} 
                        className="h-9 text-xs rounded-xl border-border/80 bg-card" 
                        onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Years of Experience</Label>
                      <Input 
                        value={customerData.yearsOfExperience || ''} 
                        className="h-9 text-xs rounded-xl border-border/80 bg-card" 
                        placeholder="e.g. 8 Years"
                        onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {customerData.clientType === 'Site Visit' && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <p className="text-xs font-bold text-foreground">Project Specifications</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Contractor Name</Label>
                      <Input 
                        value={customerData.contractorName || ''} 
                        className="h-9 text-xs rounded-xl border-border/80 bg-card" 
                        onChange={(e) => handleInputChange('contractorName', e.target.value)} 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Assigned Engineer</Label>
                      <ProfessionalSelector
                        professionals={engineerOptions}
                        value={customerData.engineerId ?? null}
                        onChange={handleEngineerSelect}
                        isLoading={isLoadingProfessionals}
                        placeholder="Select Engineer"
                        searchPlaceholder="Search engineer..."
                        emptyMessage="No engineers found"
                        legacyName={customerData.engineerName}
                        legacyContact={customerData.engineerContact}
                        legacyCity={customerData.engineerCity}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Project Type</Label>
                      <Select value={customerData.projectType || ''} onValueChange={(value) => handleInputChange('projectType', value)}>
                        <SelectTrigger className="h-9 text-xs rounded-xl border-border/80 bg-card">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {PROJECT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value} className="text-xs">{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Project Size (sq ft)</Label>
                      <Input 
                        type="number" 
                        value={customerData.projectSizeSquareFeet || ''} 
                        className="h-9 text-xs rounded-xl border-border/80 bg-card" 
                        onChange={(e) => handleInputChange('projectSizeSquareFeet', e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 bg-card flex items-center justify-between">
          <Button 
            variant="outline" 
            size="sm"
            onClick={onClose}
            className="h-9 text-xs font-medium rounded-xl border-border/80 hover:bg-muted"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="h-9 text-xs font-medium rounded-xl border-border/80 hover:bg-muted gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
            )}

            {currentStep < 4 ? (
              <Button 
                size="sm"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="h-9 text-xs font-bold rounded-xl bg-foreground text-background hover:bg-foreground/90 gap-1 transition-all"
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button 
                size="sm"
                onClick={handleSubmit}
                className="h-9 text-xs font-bold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all gap-1.5 shadow-md shadow-foreground/10"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {existingData ? 'Save Changes' : 'Create Customer'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerModal;
