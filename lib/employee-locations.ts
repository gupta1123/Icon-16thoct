/** Pure location rules shared by the map, roster and regression tests. */
import type { DashboardEmployeeVisitPoint, DashboardLiveLocationSummary, DashboardEmployeeSummary } from './api';
export interface LocationMarker {
  id: number | string;
  employeeId?: number;
  name?: string;
  lat: number;
  lng: number;
  type?: 'live' | 'house' | 'visit' | 'store';
  storeId?: number;
  subtitle?: string;
  tooltipLines?: string[];
  order?: number;
  updatedAt?: number | null;
  visitId?: number;
  coordinateSource?: string;
}

/** Most recently updated GPS first; unknown updates last, with A–Z ties. */
export function sortEmployeesByLocationUpdate<T extends {
  id: number; name: string; hasLocation?: boolean; locationTimestamp?: number | null;
}>(employees: readonly T[]): T[] {
  const timestamp = (employee: T) => employee.hasLocation &&
    employee.locationTimestamp != null && Number.isFinite(employee.locationTimestamp)
    ? employee.locationTimestamp : -Infinity;
  return [...employees].sort((left, right) => {
    const leftTime = timestamp(left), rightTime = timestamp(right);
    if (leftTime !== rightTime) return leftTime > rightTime ? -1 : 1;
    return left.name.trim().localeCompare(right.name.trim(), 'en', { sensitivity: 'base' }) || left.id - right.id;
  });
}

export function validCoordinates(lat: unknown, lng: unknown): boolean {
  if (![lat, lng].every(value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '')) return false;
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
}

/** Start on an actual employee, never the empty midpoint between distant cities. */
export function streetViewAnchor(markers: readonly LocationMarker[]): LocationMarker | undefined {
  return markers.filter(marker => validCoordinates(marker.lat, marker.lng)).sort((a, b) => {
    const time = (point: LocationMarker) => Number.isFinite(point.updatedAt) ? point.updatedAt! : -Infinity;
    const left = time(a), right = time(b);
    return left === right ? String(a.id).localeCompare(String(b.id)) : left > right ? -1 : 1;
  })[0];
}

// The API supplies Indian local date/time without an offset. Do not let the
// viewing device's timezone move a GPS update into another day.
export function locationTimestamp(date?: string | null, time?: string | null): number | null {
  if (!date) return null;
  const raw = date.includes('T') ? date : `${date}T${time || '00:00:00'}`;
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}+05:30`;
  const value = Date.parse(zoned);
  return Number.isFinite(value) ? value : null;
}

export function locationAge(timestamp: number | null | undefined, now = Date.now()) {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp > now + 60_000) {
    return { label: 'Update time unavailable', fresh: false };
  }
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  const age = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hr ago` : `${Math.floor(minutes / 1440)} days ago`;
  return { label: `Updated ${age}`, fresh: minutes < 15 };
}

export function formatLocationTime(timestamp: number | null | undefined): string {
  return timestamp == null || !Number.isFinite(timestamp) ? 'Time unavailable' : new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(timestamp) + ' IST';
}

export function latestLocationMarkers(rows: Array<{ empId: number; empName: string; latitude: number; longitude: number; updatedAt: string; updatedTime: string }>): LocationMarker[] {
  const latest = new Map<number, LocationMarker>();
  for (const row of rows) {
    if (!validCoordinates(row.latitude, row.longitude)) continue;
    const updatedAt = locationTimestamp(row.updatedAt, row.updatedTime);
    const previous = latest.get(row.empId);
    if (previous && (previous.updatedAt ?? -Infinity) >= (updatedAt ?? -Infinity)) continue;
    latest.set(row.empId, { id: row.empId, employeeId: row.empId, name: row.empName,
      lat: Number(row.latitude), lng: Number(row.longitude), type: 'live', updatedAt,
      subtitle: formatLocationTime(updatedAt) });
  }
  return [...latest.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

interface JourneyPoint {
  id: number; employeeId: number; employeeName: string; storeName: string;
  lat: number; lng: number; coordinateSource: string; visitDate: string;
  checkinDate?: string | null; checkinTime?: string | null;
  checkoutDate?: string | null; checkoutTime?: string | null;
  purpose?: string | null; city?: string | null; state?: string | null; country?: string | null;
}

export function journeyLocationMarkers(visits: JourneyPoint[], start: string, end: string) {
  const unique = new Map<number, JourneyPoint>();
  for (const visit of visits) {
    const day = (visit.checkinDate || visit.visitDate || '').slice(0, 10);
    if (day >= start && day <= end) unique.set(visit.id, visit);
  }
  const ordered = [...unique.values()].sort((a, b) =>
    (locationTimestamp(a.checkinDate || a.visitDate, a.checkinTime) ?? Infinity) -
    (locationTimestamp(b.checkinDate || b.visitDate, b.checkinTime) ?? Infinity) || a.id - b.id);
  const markers: LocationMarker[] = [];
  ordered.forEach((visit, index) => {
    if (!validCoordinates(visit.lat, visit.lng)) return;
    const place = [visit.city, visit.state, visit.country].filter(Boolean).join(', ');
    markers.push({ id: `visit-${visit.id}`, visitId: visit.id, employeeId: visit.employeeId,
      name: visit.storeName || 'Visit', lat: Number(visit.lat), lng: Number(visit.lng), type: 'visit', order: index + 1,
      coordinateSource: visit.coordinateSource, subtitle: visit.purpose || 'Visit',
      tooltipLines: [
        `Check-in: ${formatLocationTime(locationTimestamp(visit.checkinDate || visit.visitDate, visit.checkinTime))}`,
        `Check-out: ${visit.checkoutDate ? formatLocationTime(locationTimestamp(visit.checkoutDate, visit.checkoutTime)) : 'Not recorded'}`,
        ...(place ? [`Customer address: ${place}`] : []),
      ] });
  });
  return { markers, total: ordered.length, unmapped: ordered.length - markers.length };
}

/** Group nearby screen points, without changing the underlying GPS coordinates. */
export function groupNearbyPoints<T extends { x: number; y: number }>(points: T[], distance = 44): T[][] {
  const groups: T[][] = [];
  for (const point of points) {
    const matches = groups.filter(group => group.some(other => Math.hypot(point.x - other.x, point.y - other.y) < distance));
    if (!matches.length) groups.push([point]);
    else {
      matches[0].push(point);
      for (const group of matches.slice(1)) { matches[0].push(...group); groups.splice(groups.indexOf(group), 1); }
    }
  }
  return groups;
}

/** Icon's overview/trail endpoints differ from German's; never cross backends. */
export function iconLatestMarkers(rows: DashboardLiveLocationSummary[]): LocationMarker[] {
  const latest = new Map<number, LocationMarker>();
  for (const row of rows) {
    const candidates = [
      { lat: row.latitude, lng: row.longitude, source: row.source || 'LIVE', time: row.updatedAt },
      { lat: row.lastVisitLatitude, lng: row.lastVisitLongitude, source: 'VISIT', time: row.lastVisitAt },
      { lat: row.fallbackLatitude, lng: row.fallbackLongitude, source: row.source || 'UNKNOWN', time: null },
    ];
    const point = candidates.find(candidate => validCoordinates(candidate.lat, candidate.lng));
    if (!point) continue;
    const updatedAt = locationTimestamp(point.source === 'HOME' ? null : point.time || (point.source === 'VISIT' ? row.lastVisitAt : null));
    const previous = latest.get(row.employeeId);
    if (previous && (previous.updatedAt ?? -Infinity) >= (updatedAt ?? -Infinity)) continue;
    latest.set(row.employeeId, {
      id: `location-${row.employeeId}`, employeeId: row.employeeId, name: row.employeeName,
      lat: Number(point.lat), lng: Number(point.lng), type: point.source === 'HOME' ? 'house' : 'live', updatedAt,
      subtitle: formatLocationTime(updatedAt), coordinateSource: point.source,
      tooltipLines: point.source === 'VISIT' ? [`Source: Last recorded visit${row.lastVisitStoreName ? ` · ${row.lastVisitStoreName}` : ''}`] : [],
    });
  }
  return [...latest.values()];
}

export function iconJourneyMarkers(points: DashboardEmployeeVisitPoint[], employeeId: number, employeeName: string, start: string, end: string, summary?: DashboardEmployeeSummary) {
  const visits = new Map<string, DashboardEmployeeVisitPoint[]>();
  const special: LocationMarker[] = [];
  const localDay = (value: string) => {
    const timestamp = locationTimestamp(value);
    return timestamp == null ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);
  };
  for (const point of points) {
    if (point.type === 'HOME' || point.type === 'CURRENT') {
      if (!validCoordinates(point.latitude, point.longitude)) continue;
      const type = point.type === 'HOME' ? 'house' : 'live';
      const marker = { id: `${type}-${employeeId}`, employeeId, name: type === 'house' ? `${employeeName} · Home` : employeeName,
        lat: Number(point.latitude), lng: Number(point.longitude), type, updatedAt: locationTimestamp(point.timestamp),
        subtitle: type === 'house' ? 'Registered home location' : formatLocationTime(locationTimestamp(point.timestamp)), coordinateSource: point.type } satisfies LocationMarker;
      const previous = special.findIndex(item => item.type === type);
      if (previous < 0) special.push(marker);
      else if ((marker.updatedAt ?? -Infinity) > (special[previous].updatedAt ?? -Infinity)) special[previous] = marker;
      continue;
    }
    const key = point.visitId != null ? String(point.visitId) : `${point.type}:${point.timestamp}:${point.latitude}:${point.longitude}`;
    const group = visits.get(key) || [];
    group.push(point);
    visits.set(key, group);
  }
  const time = (point: DashboardEmployeeVisitPoint) => locationTimestamp(point.timestamp) ?? Infinity;
  const ordered = [...visits.values()].filter(group => {
    const events = [...group].sort((a, b) => time(a) - time(b));
    const anchor = events.find(point => point.type === 'CHECKIN') || events.find(point => point.type === 'VISIT') || events[0];
    // A visit belongs to its check-in day, including an after-midnight checkout.
    // The date-scoped API is authoritative when the anchor has no timestamp.
    if (!anchor.timestamp) return true;
    const day = localDay(anchor.timestamp);
    return Boolean(day && day >= start && day <= end);
  }).sort((a, b) => Math.min(...a.map(time)) - Math.min(...b.map(time)) || (a[0].visitId ?? 0) - (b[0].visitId ?? 0));
  const markers: LocationMarker[] = [];
  ordered.forEach((group, index) => {
    const orderedPoints = [...group].sort((a, b) => time(a) - time(b));
    const valid = orderedPoints.filter(point => validCoordinates(point.latitude, point.longitude));
    const point = valid.find(point => point.type === 'CHECKIN') || valid.find(point => point.type === 'VISIT') || valid[0];
    if (!point) return;
    const checkin = orderedPoints.find(point => point.type === 'CHECKIN');
    const checkout = [...orderedPoints].reverse().find(point => point.type === 'CHECKOUT');
    markers.push({ id: `visit-${point.visitId ?? index}`, employeeId, visitId: point.visitId ?? undefined,
      name: point.storeName || point.label || 'Visit', lat: Number(point.latitude), lng: Number(point.longitude),
      type: 'visit', order: index + 1, coordinateSource: point.type,
      subtitle: point.label || 'Visit', tooltipLines: [
        `Employee: ${employeeName}`,
        `Check-in: ${checkin ? formatLocationTime(locationTimestamp(checkin.timestamp)) : 'Not recorded'}`,
        `Check-out: ${checkout ? formatLocationTime(locationTimestamp(checkout.timestamp)) : 'Not recorded'}`,
        ...(!checkin && !checkout ? [`Recorded: ${formatLocationTime(locationTimestamp(point.timestamp))}`] : []),
      ] });
  });
  if (!special.some(marker => marker.type === 'house') && validCoordinates(summary?.homeLatitude, summary?.homeLongitude)) {
    special.push({ id: `house-${employeeId}`, employeeId, name: `${employeeName} · Home`, lat: Number(summary!.homeLatitude), lng: Number(summary!.homeLongitude), type: 'house', subtitle: 'Registered home location', coordinateSource: 'HOME' });
  }
  return { markers: [...markers, ...special], total: ordered.length, unmapped: ordered.length - markers.length, hasHome: special.some(marker => marker.type === 'house') };
}
