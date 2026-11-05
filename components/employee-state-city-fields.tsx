'use client';

import { useEffect, useMemo, useState } from 'react';
import { API } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  state: string;
  city: string;
  onChange: (field: 'state' | 'city', value: string) => void;
  stateError?: string;
  cityError?: string;
}

/** Residential location fields shared by employee creation and editing. */
export function EmployeeStateCityFields({ state: stateProp, city, onChange, stateError, cityError }: Props) {
  const [states, setStates] = useState<string[]>([]);
  const [statesLoading, setStatesLoading] = useState(true);
  const [statesError, setStatesError] = useState(false);
  const [cityResult, setCityResult] = useState<{ state: string; cities: string[] } | null>(null);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState(false);
  const [cityRetry, setCityRetry] = useState(0);

  useEffect(() => {
    let active = true;
    API.getAllStates()
      .then(result => {
        if (!active) return;
        setStates(result.map(item => item.stateName?.trim()).filter((name): name is string => Boolean(name)));
        setStatesError(false);
      })
      .catch(() => { if (active) setStatesError(true); })
      .finally(() => { if (active) setStatesLoading(false); });
    return () => { active = false; };
  }, []);

  const stateOptions = useMemo(() => {
    const names = [...new Set(states)];
    return stateProp && !names.some(name => name.toLowerCase() === stateProp.toLowerCase()) ? [stateProp, ...names] : names;
  }, [states, stateProp]);
  const selectedState = stateOptions.find(name => name.toLowerCase() === stateProp.toLowerCase()) ?? stateProp;
  const queryState = selectedState.trim().toUpperCase() === 'MP' ? 'Madhya Pradesh' : selectedState.trim();

  useEffect(() => {
    const controller = new AbortController();
    setCityResult(null);
    setCitiesError(false);
    if (!queryState) {
      setCitiesLoading(false);
      return () => controller.abort();
    }
    setCitiesLoading(true);
    API.getResidentialCitiesByState(queryState, controller.signal)
      .then(cities => {
        if (!controller.signal.aborted) setCityResult({ state: queryState, cities });
      })
      .catch(() => { if (!controller.signal.aborted) setCitiesError(true); })
      .finally(() => { if (!controller.signal.aborted) setCitiesLoading(false); });
    return () => controller.abort();
  }, [queryState, cityRetry]);

  const citiesReady = cityResult?.state === queryState;
  const cityOptions = useMemo(() => {
    const names = cityResult?.state === queryState ? cityResult.cities : [];
    // Preserve the saved residential value when editing older employee records.
    return city && !names.some(name => name.toLowerCase() === city.toLowerCase()) ? [city, ...names] : names;
  }, [cityResult, queryState, city]);
  const selectedCity = cityOptions.find(name => name.toLowerCase() === city.toLowerCase()) ?? city;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="employee-state">State<span className="text-red-500"> *</span></Label>
        <Select value={selectedState || undefined} onValueChange={value => {
          if (!value || value.toLowerCase() === stateProp.toLowerCase()) return;
          setCityResult(null);
          setCitiesError(false);
          onChange('state', value);
          onChange('city', '');
        }}>
          <SelectTrigger id="employee-state" className="h-9 bg-background" aria-invalid={Boolean(stateError)}>
            <SelectValue placeholder={statesLoading ? 'Loading states...' : 'Select state'} />
          </SelectTrigger>
          <SelectContent>{stateOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
        </Select>
        {stateError && <span className="text-xs text-destructive">{stateError}</span>}
        {statesError && <span className="text-xs text-destructive">Could not load the state list. Reload the page to retry.</span>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="employee-city">City<span className="text-red-500"> *</span></Label>
        <SearchableSelect
          triggerId="employee-city"
          options={cityOptions.map(name => ({ value: name, label: name }))}
          value={selectedCity || undefined}
          onSelect={option => onChange('city', option?.value ?? '')}
          placeholder={queryState ? 'Select residential city' : 'Select state first'}
          searchPlaceholder="Search cities"
          noResultsMessage="No matching city"
          emptyMessage={citiesError ? 'Could not load cities' : 'No cities found for this state'}
          disabled={!queryState || (!citiesReady && !citiesError)}
          loading={citiesLoading}
          loadingMessage="Loading cities..."
          pageSize={100}
          triggerClassName="h-9 bg-background"
        />
        {citiesError && <span role="alert" className="text-xs text-destructive">Could not load residential cities. <button type="button" className="underline" onClick={() => setCityRetry(value => value + 1)}>Retry</button></span>}
        {cityError && <span className="text-xs text-destructive">{cityError}</span>}
      </div>
    </>
  );
}
