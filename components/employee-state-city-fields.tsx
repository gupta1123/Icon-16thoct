'use client';

import { useEffect, useMemo, useState } from 'react';
import { API, type StateDto } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select2';

interface Props {
  state: string;
  city: string;
  onChange: (field: 'state' | 'city', value: string) => void;
  stateError?: string;
  cityError?: string;
}

/** Residential location fields shared by employee creation and editing. */
export function EmployeeStateCityFields({ state: stateProp, city, onChange, stateError, cityError }: Props) {
  const [states, setStates] = useState<StateDto[]>([]);
  const [statesLoading, setStatesLoading] = useState(true);
  const [statesError, setStatesError] = useState(false);
  const [cityResult, setCityResult] = useState<{ stateId: number; cities: string[] } | null>(null);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState(false);
  const [cityRetry, setCityRetry] = useState(0);
  const [unavailableCity, setUnavailableCity] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    API.getResidentialStates(controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setStates(result.filter(item => item.stateName?.trim()).map(item => ({ ...item, stateName: item.stateName.trim() })));
        setStatesError(false);
      })
      .catch(() => { if (!controller.signal.aborted) setStatesError(true); })
      .finally(() => { if (!controller.signal.aborted) setStatesLoading(false); });
    return () => controller.abort();
  }, []);

  const stateOptions = useMemo(() => {
    const names = [...new Set(states.map(item => item.stateName))];
    return stateProp && !names.some(name => name.toLowerCase() === stateProp.toLowerCase()) ? [stateProp, ...names] : names;
  }, [states, stateProp]);
  const selectedState = stateOptions.find(name => name.toLowerCase() === stateProp.toLowerCase()) ?? stateProp;
  const queryState = selectedState.trim().toUpperCase() === 'MP' ? 'Madhya Pradesh' : selectedState.trim();
  const stateId = states.find(item => item.stateName.toLowerCase() === queryState.toLowerCase())?.id;

  useEffect(() => {
    const controller = new AbortController();
    setCityResult(null);
    setCitiesError(false);
    if (stateId === undefined) {
      setCitiesLoading(false);
      return () => controller.abort();
    }
    setCitiesLoading(true);
    API.getResidentialCitiesByState(stateId, controller.signal)
      .then(cities => {
        if (!controller.signal.aborted) setCityResult({ stateId, cities });
      })
      .catch(() => { if (!controller.signal.aborted) setCitiesError(true); })
      .finally(() => { if (!controller.signal.aborted) setCitiesLoading(false); });
    return () => controller.abort();
  }, [stateId, cityRetry]);

  const citiesReady = stateId !== undefined && cityResult?.stateId === stateId;
  const cityOptions = useMemo(() => {
    return stateId !== undefined && cityResult?.stateId === stateId ? cityResult.cities : [];
  }, [cityResult, stateId]);
  const selectedCity = cityOptions.find(name => name.toLowerCase() === city.toLowerCase()) ?? city;

  useEffect(() => {
    if (citiesReady && city && !cityOptions.some(name => name.toLowerCase() === city.trim().toLowerCase())) {
      setUnavailableCity(city);
      onChange('city', '');
    }
  }, [citiesReady, city, cityOptions, onChange]);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="employee-state">State<span className="text-red-500"> *</span></Label>
        <SearchableSelect triggerId="employee-state"
          options={stateOptions.map(name => ({ value: name, label: name }))}
          value={selectedState || undefined}
          onSelect={option => {
            const value = option?.value;
            if (!value || value.toLowerCase() === stateProp.toLowerCase()) return;
            setCityResult(null);
            setCitiesError(false);
            setUnavailableCity('');
            onChange('state', value);
            onChange('city', '');
          }}
          placeholder="Select state"
          searchPlaceholder="Search states"
          noResultsMessage="No matching state"
          emptyMessage={statesError ? 'Could not load states' : 'No states available'}
          disabled={statesLoading}
          loading={statesLoading}
          loadingMessage="Loading states..."
          required
          triggerClassName="h-9 w-full min-w-0 bg-background"
          contentClassName="w-[var(--radix-popover-trigger-width)]"
        />
        {stateError && <span className="text-xs text-destructive">{stateError}</span>}
        {statesError && <span className="text-xs text-destructive">Could not load the state list. Reload the page to retry.</span>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="employee-city">City<span className="text-red-500"> *</span></Label>
        <SearchableSelect
          triggerId="employee-city"
          options={cityOptions.map(name => ({ value: name, label: name }))}
          value={selectedCity || undefined}
          onSelect={option => { setUnavailableCity(''); onChange('city', option?.value ?? ''); }}
          placeholder={queryState ? 'Select residential city' : 'Select state first'}
          searchPlaceholder="Search cities"
          noResultsMessage="No matching city"
          emptyMessage={citiesError ? 'Could not load cities' : 'No cities found for this state'}
          disabled={stateId === undefined || (!citiesReady && !citiesError)}
          loading={citiesLoading}
          loadingMessage="Loading cities..."
          pageSize={100}
          required
          triggerClassName="h-9 w-full min-w-0 bg-background"
          contentClassName="w-[var(--radix-popover-trigger-width)]"
        />
        {citiesError && <span role="alert" className="text-xs text-destructive">Could not load residential cities. <button type="button" className="underline" onClick={() => setCityRetry(value => value + 1)}>Retry</button></span>}
        {unavailableCity && <span className="text-xs text-muted-foreground">{unavailableCity} is not in this state's city list. Select a city from the available options.</span>}
        {cityError && <span className="text-xs text-destructive">{cityError}</span>}
      </div>
    </>
  );
}
