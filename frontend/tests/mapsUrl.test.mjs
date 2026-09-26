import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapsLinks } from '../src/lib/mapsUrl.ts';

const places = Array.from({ length: 10 }, (_, i) => ({ lat: 35 + i / 100, lng: 139 + i / 100 }));
const coordinate = p => `${p.lat},${p.lng}`;

test('long itinerary preserves all stops in order across mobile links', () => {
  const links = mapsLinks(places, 'WALK');
  assert.equal(links.length, 3);
  const restored = [];
  links.forEach(({ url }, i) => {
    assert.ok(url.length < 2048);
    const params = new URL(url).searchParams;
    assert.equal(params.get('api'), '1');
    assert.equal(params.get('travelmode'), 'walking');
    const waypoints = params.get('waypoints')?.split('|') ?? [];
    assert.ok(waypoints.length <= 3);
    const stops = [params.get('origin'), ...waypoints, params.get('destination')];
    if (i) assert.equal(restored.at(-1), stops[0]);
    restored.push(...stops.slice(i ? 1 : 0));
  });
  assert.deepEqual(restored, places.map(coordinate));
});

test('round trip keeps matching endpoints and driving mode', () => {
  const [link] = mapsLinks([places[0], places[1], places[0]], 'DRIVE');
  const params = new URL(link.url).searchParams;
  assert.equal(params.get('origin'), params.get('destination'));
  assert.equal(params.get('waypoints'), coordinate(places[1]));
  assert.equal(params.get('travelmode'), 'driving');
});

test('transit uses adjacent pairs and empty routes have no links', () => {
  const links = mapsLinks(places, 'TRANSIT');
  assert.equal(links.length, 9);
  links.forEach(({url, start, end}) => {
    const params = new URL(url).searchParams;
    assert.equal(end, start + 1);
    assert.equal(params.get('travelmode'), 'transit');
    assert.equal(params.get('waypoints'), null);
  });
  assert.deepEqual(mapsLinks([], 'WALK'), []);
  assert.deepEqual(mapsLinks([places[0]], 'WALK'), []);
});
