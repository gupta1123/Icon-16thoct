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

/** Controlled State and (home) City pickers for the employee form. City = district of the chosen state (BE-030 / FE-036). */
export function EmployeeStateCityFields({ state: stateProp, city, onChange, stateError, cityError }: Props) {
  const [pairs, setPairs] = useState<Array<{ state: string; district: string }>>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    API.getKeyStateDistricts().then(result => { if (active) setPairs(result); }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);

  // Older records may have a city but no state: show the state only when the city belongs to exactly one state (display only, not saved).
  const state = useMemo(() => {
    if (stateProp || !city) return stateProp;
    const owners = [...new Set(pairs.filter(p => p.district.toLowerCase() === city.toLowerCase()).map(p => p.state))];
    return owners.length === 1 ? owners[0] : stateProp;
  }, [stateProp, city, pairs]);

  // Legacy record with a city but no state: save the inferred state too, so the required-state check passes and the data gets fixed.
  useEffect(() => {
    if (!stateProp && state) onChange('state', state);
  }, [stateProp, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const states = useMemo(() => {
    const names = [...new Set(pairs.map(p => p.state))];
    return state && !names.some(n => n.toLowerCase() === state.toLowerCase()) ? [state, ...names] : names;
  }, [pairs, state]);
  const selectedState = states.find(n => n.toLowerCase() === state.toLowerCase()) ?? state;
  const cities = useMemo(() => {
    const names = pairs.filter(p => p.state.toLowerCase() === state.toLowerCase()).map(p => p.district);
    return city && !names.some(n => n.toLowerCase() === city.toLowerCase()) ? [city, ...names] : names;
  }, [pairs, state, city]);
  const selectedCity = cities.find(n => n.toLowerCase() === city.toLowerCase()) ?? city;
  const notInList = (value: string, list: string[], base: string[]) => Boolean(value) && !base.some(n => n.toLowerCase() === value.toLowerCase()) && list.includes(value);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="employee-state">State<span className="text-red-500"> *</span></Label>
        <Select value={selectedState || undefined} onValueChange={value => { if (!value || value.toLowerCase() === (state || '').toLowerCase()) return; onChange('state', value); onChange('city', ''); }}>
          <SelectTrigger id="employee-state" className="h-9 bg-background" aria-invalid={Boolean(stateError)}><SelectValue placeholder={pairs.length ? 'Select state' : 'Loading states...'} /></SelectTrigger>
          <SelectContent>{states.map(name => <SelectItem key={name} value={name}>{name}{notInList(name, states, pairs.map(p => p.state)) ? ' (not in list)' : ''}</SelectItem>)}</SelectContent>
        </Select>
        {stateError && <span className="text-xs text-destructive">{stateError}</span>}
        {loadError && <span className="text-xs text-destructive">Could not load the state list. Reload the page to retry.</span>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="employee-city">City<span className="text-red-500"> *</span></Label>
        <SearchableSelect
          triggerId="employee-city"
          options={cities.map(name => ({ value: name, label: `${name}${notInList(name, cities, pairs.filter(p => p.state.toLowerCase() === state.toLowerCase()).map(p => p.district)) ? ' (not in list)' : ''}` }))}
          value={selectedCity || undefined}
          onSelect={option => onChange('city', option?.value ?? '')}
          placeholder={state ? 'Select city / district' : 'Select state first'}
          searchPlaceholder="Search cities"
          noResultsMessage="No matching city"
          disabled={!state}
          triggerClassName="h-9 bg-background"
        />
        {cityError && <span className="text-xs text-destructive">{cityError}</span>}
      </div>
    </>
  );
}
