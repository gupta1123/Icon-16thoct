"use client";

import { useState } from 'react';
import { Search } from 'lucide-react';
import { cityLabel } from '@/lib/team-settings';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function TeamCityPicker({ cities, selected, onChange, disabled = false }: { cities: string[]; selected: string[]; onChange: (cities: string[]) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const filtered = cities.filter(city => city.toLowerCase().includes(query.trim().toLowerCase()));
  return <Popover onOpenChange={open => { if (!open) setQuery(''); }}>
    <PopoverTrigger asChild><Button variant="outline" disabled={disabled} className="w-full justify-between text-left font-normal"><span className={selected.length ? '' : 'text-muted-foreground'}>{selected.length ? `${selected.length} cities selected` : 'Select cities to add'}</span><Search className="h-4 w-4 text-muted-foreground" /></Button></PopoverTrigger>
    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start"><div className="border-b p-3"><Input aria-label="Search cities" placeholder="Search cities..." value={query} onChange={event => setQuery(event.target.value)} /></div><div className="max-h-64 space-y-1 overflow-y-auto p-2">{filtered.map(city => <label key={city} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/40"><Checkbox checked={selected.includes(city)} onCheckedChange={checked => onChange(checked ? [...new Set([...selected, city])] : selected.filter(item => item !== city))} /><span className="text-sm">{cityLabel(city)}</span></label>)}{!filtered.length && <div className="p-4 text-sm text-muted-foreground">No cities available</div>}</div></PopoverContent>
  </Popover>;
}
