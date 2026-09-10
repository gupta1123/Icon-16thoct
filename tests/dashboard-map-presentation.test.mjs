import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const map = source('../components/employee-location-map.tsx');
const styles = source('../components/location-map.css');
const overview = source('../components/dashboard/overview-section.tsx');
const liveView = source('../components/dashboard/live-view.tsx');

test('overview opens at road-readable city zoom without limiting employee journey bounds', () => {
  assert.match(overview, /streetOverview=\{selectedId == null\}/);
  assert.match(map, /map\.getBoundsZoom\(bounds, false, L\.point\(144, 144\)\) < 11/);
  assert.match(map, /map\.setView\(\[anchor\.lat, anchor\.lng\], 11/);
  assert.match(map, /View all locations/);
  assert.match(map, /streetOverview = false/);
});

test('dashboard map uses the reference controls without extra appearance or store tabs', () => {
  assert.doesNotMatch(map, /Map appearance|setStreetMap|>Streets<|>Muted<|Zoom to street/);
  assert.doesNotMatch(overview, /props\.toolbar/);
  assert.doesNotMatch(liveView, /toolbar=|>Stores</);
  assert.match(overview, /Refresh employee locations/);
  assert.match(overview, /Reset view/);
});

test('street tiles follow the page theme without an unfiltered appearance override', () => {
  assert.match(map, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(styles, /\.leaflet-tile-pane \{ filter: saturate\(\.5\); \}/);
  assert.match(styles, /\.dark \.employee-location-map \.leaflet-tile-pane \{ filter: invert\(1\) hue-rotate\(180deg\) saturate\(\.35\) brightness\(\.8\); \}/);
  assert.doesNotMatch(styles, /street-map|filter: none/);
});

test('reference mobile navigation and recorded-location details remain available', () => {
  assert.match(overview, /aria-label="Location display"/);
  assert.match(overview, /mode === 'map' \? 'Map' : 'Employees'/);
  assert.match(map, /Recorded coordinates:/);
  assert.match(map, /View customer details/);
  assert.match(map, /View visit details/);
});
