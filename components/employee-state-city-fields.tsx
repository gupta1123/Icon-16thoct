'use client';

import { useEffect, useMemo, useState } from 'react';
import { API } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface Props {
  state: string;
  city: string;
  onChange: (field: 'state' | 'city', value: string) => void;
  stateError?: string;
  cityError?: string;
}

const CITY_PAGE_SIZE = 100;

/** Controlled State and residential City pickers for the employee create/edit forms. */
export function EmployeeStateCityFields({ state: stateProp, city, onChange, stateError, cityError }: Props) {
  const [states, setStates] = useState<string[]>([]);
  const [statesLoading, setStatesLoading] = useState(true);
  const [statesError, setStatesError] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [cityPage, setCityPage] = useState(0);
  const [cityTotalPages, setCityTotalPages] = useState(1);
  const [cityTotalElements, setCityTotalElements] = useState(0);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState(false);
  const [cityRetry, setCityRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setStatesLoading(true);
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

  useEffect(() => {
    if (!stateProp) {
      setCities([]);
      setCityTotalPages(1);
      setCityTotalElements(0);
      setCitiesError(false);
      return;
    }
    let active = true;
    setCitiesLoading(true);
    setCitiesError(false);
    API.getResidentialCitiesPage(cityPage, CITY_PAGE_SIZE)
      .then(result => {
        if (!active) return;
        setCities(result.cities);
        setCityTotalPages(result.totalPages);
        setCityTotalElements(result.totalElements);
        if (result.page !== cityPage) setCityPage(result.page);
      })
      .catch(() => { if (active) setCitiesError(true); })
      .finally(() => { if (active) setCitiesLoading(false); });
    return () => { active = false; };
  }, [stateProp, cityPage, cityRetry]);

  const stateOptions = useMemo(() => {
    const names = [...new Set(states)];
    return stateProp && !names.some(name => name.toLowerCase() === stateProp.toLowerCase()) ? [stateProp, ...names] : names;
  }, [states, stateProp]);
  const selectedState = stateOptions.find(name => name.toLowerCase() === stateProp.toLowerCase()) ?? stateProp;
  const cityOptions = useMemo(() => {
    const names = [...cities];
    return city && !names.some(name => name.toLowerCase() === city.toLowerCase()) ? [city, ...names] : names;
  }, [cities, city]);
  const selectedCity = cityOptions.find(name => name.toLowerCase() === city.toLowerCase()) ?? city;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="employee-state">State<span className="text-red-500"> *</span></Label>
        <Select value={selectedState || undefined} onValueChange={value => { if (!value || value.toLowerCase() === stateProp.toLowerCase()) return; setCityPage(0); onChange('state', value); onChange('city', ''); }}>
          <SelectTrigger id="employee-state" className="h-9 bg-background" aria-invalid={Boolean(stateError)}><SelectValue placeholder={statesLoading ? 'Loading states...' : 'Select state'} /></SelectTrigger>
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
          placeholder={stateProp ? 'Select residential city' : 'Select state first'}
          searchPlaceholder="Search cities"
          noResultsMessage="No matching city"
          emptyMessage={citiesError ? 'Could not load cities' : 'No cities on this page'}
          disabled={!stateProp}
          loading={citiesLoading}
          loadingMessage="Loading cities..."
          triggerClassName="h-9 bg-background"
        />
        {stateProp && !citiesLoading && !citiesError && <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={cityPage === 0} onClick={() => setCityPage(page => Math.max(0, page - 1))}>Previous</Button>
          <span>Page {cityPage + 1} of {cityTotalPages}{cityTotalElements ? ` · ${cityTotalElements} cities` : ''}</span>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={cityPage + 1 >= cityTotalPages} onClick={() => setCityPage(page => Math.min(cityTotalPages - 1, page + 1))}>Next</Button>
        </div>}
        {citiesError && <span className="text-xs text-destructive">Could not load residential cities. <button type="button" className="underline" onClick={() => setCityRetry(value => value + 1)}>Retry</button></span>}
        {cityError && <span className="text-xs text-destructive">{cityError}</span>}
      </div>
    </>
  );
}
