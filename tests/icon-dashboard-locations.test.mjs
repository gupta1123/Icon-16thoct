import test from 'node:test';
import assert from 'node:assert/strict';
import { iconLatestMarkers, iconJourneyMarkers, validCoordinates, locationTimestamp } from '../lib/employee-locations.ts';

const location = { employeeId: 1, employeeName: 'Officer', latitude: 18, longitude: 73, source: 'LIVE', updatedAt: '2026-09-03T10:00:00', lastVisitAt: null };
const visit = { visitId: 8, type: 'VISIT', latitude: 18.1, longitude: 73.1, timestamp: '2026-09-03T10:00:00', label: 'Dealer visit', storeName: 'Store' };
const journey = points => iconJourneyMarkers(points, 1, 'Officer', '2026-09-03', '2026-09-03');

test('Icon GPS deduplicates by employee and keeps the newest valid fix', () => {
  const markers = iconLatestMarkers([location, { ...location, latitude: 19, updatedAt: '2026-09-03T12:00:00' }, { ...location, latitude: NaN, longitude: null, updatedAt: '2026-09-03T13:00:00' }]);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].lat, 19);
  assert.equal(markers[0].updatedAt, locationTimestamp('2026-09-03T12:00:00'));
});
test('coordinate fallbacks use complete pairs and never invent a GPS time', () => {
  const [marker] = iconLatestMarkers([{ ...location, latitude: null, lastVisitLatitude: 20, lastVisitLongitude: 75, lastVisitAt: '2026-09-02T11:00:00' }]);
  assert.deepEqual([marker.lat, marker.lng], [20, 75]);
  assert.equal(marker.coordinateSource, 'VISIT');
  assert.equal(marker.updatedAt, locationTimestamp('2026-09-02T11:00:00'));
  assert.equal(iconLatestMarkers([{ ...location, source: 'HOME' }])[0].updatedAt, null);
  assert.equal(iconLatestMarkers([{ ...location, updatedAt: null }])[0].updatedAt, null);
});
test('invalid values do not become valid zero coordinates', () => {
  for (const pair of [[true, 73], ['  ', 73], [[], 73], [{}, 73]]) assert.equal(validCoordinates(...pair), false);
});
test('checkin, checkout, repeated VISIT points become one numbered visit with both timestamps', () => {
  const result = journey([visit, { ...visit, type: 'CHECKOUT', timestamp: '2026-09-03T11:00:00' }, { ...visit, type: 'CHECKIN', latitude: 18.2, timestamp: '2026-09-03T09:00:00' }, visit]);
  assert.equal(result.total, 1);
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].lat, 18.2);
  assert.equal(result.markers[0].visitId, 8);
  assert.equal(result.markers[0].order, 1);
  assert.match(result.markers[0].tooltipLines.join(' '), /Check-in: .*Check-out:/);
});
test('missing coordinates retain gaps and visits sort chronologically', () => {
  const result = journey([{ ...visit, visitId: 9, timestamp: '2026-09-03T12:00:00' }, { ...visit, visitId: 7, latitude: 0, longitude: 0, timestamp: '2026-09-03T09:00:00' }, visit]);
  assert.equal(result.total, 3);
  assert.equal(result.unmapped, 1);
  assert.deepEqual(result.markers.map(marker => [marker.visitId, marker.order]), [[8, 2], [9, 3]]);
});
test('date range is evaluated in IST and excludes out-of-period visit points', () => {
  const result = journey([{ ...visit, visitId: 7, timestamp: '2026-09-02T19:00:00Z' }, { ...visit, visitId: 9, timestamp: '2026-09-03T19:00:00Z' }]);
  assert.equal(result.total, 1);
  assert.equal(result.markers[0].visitId, 7);
});
test('a cross-midnight visit belongs to check-in day and retains its checkout details', () => {
  const points = [{ ...visit, type: 'CHECKIN', timestamp: '2026-09-03T23:55:00' }, { ...visit, type: 'CHECKOUT', timestamp: '2026-09-04T00:10:00' }];
  const result = journey(points);
  assert.equal(result.total, 1);
  assert.match(result.markers[0].tooltipLines.join(' '), /4 Sept 2026/);
  assert.equal(iconJourneyMarkers(points, 1, 'Officer', '2026-09-04', '2026-09-04').total, 0);
});
test('home/current locations remain available outside the visit date range, invalid homes are omitted', () => {
  const result = journey([{ ...visit, type: 'HOME', visitId: null, timestamp: null }, { ...visit, type: 'CURRENT', timestamp: '2026-08-01T10:00:00' }]);
  assert.equal(result.total, 0);
  assert.equal(result.hasHome, true);
  assert.deepEqual(result.markers.map(marker => marker.type), ['house', 'live']);
  assert.equal(journey([{ ...visit, type: 'HOME', latitude: 0, longitude: 0 }]).hasHome, false);
});
test('summary home fallback is available even with an empty trail and is never duplicated', () => {
  const summary = { homeLatitude: 19, homeLongitude: 74 };
  assert.equal(iconJourneyMarkers([], 1, 'Officer', '2026-09-03', '2026-09-03', summary).hasHome, true);
  const result = iconJourneyMarkers([{ ...visit, type: 'HOME' }], 1, 'Officer', '2026-09-03', '2026-09-03', summary);
  assert.equal(result.markers.filter(marker => marker.type === 'house').length, 1);
  assert.equal(result.markers[0].lat, visit.latitude);
});
