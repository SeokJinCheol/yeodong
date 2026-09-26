import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fallbackRoute, orderedPlacesFor, plannerDates, routingKeyFor, moveDayEntries, removeDayEntries} from '../src/lib/planner.ts';

const date = '2026-10-08';
const place = (id, extra = {}) => ({id, name: `Place ${id}`, lat: 35 + id / 100, lng: 139, visit_date: date, stay_minutes: 30, required_order: null, required_time: null, tasks: [], ...extra});

test('fixed STEP positions leave remaining visits in registration order without modifying input', () => {
    const places = [place(1), place(2), place(3, {required_order: 1}), place(4), place(5)];
    const before = structuredClone(places);
    const result = fallbackRoute(places, date, 1, 5);
    assert.deepEqual(result.places.map(p => p.id), [1, 3, 2, 4, 5]);
    assert.equal(result.invalidOrder, false);
    assert.equal(result.middleCount, 3);
    assert.deepEqual(places, before);
});

test('duplicate and out-of-range fixed steps preserve every visit and report invalid order', () => {
    const places = [place(1), place(2, {required_order: 1}), place(3, {required_order: 1}), place(4, {required_order: 9}), place(5)];
    const result = fallbackRoute(places, date, 1, 5);
    assert.deepEqual(result.places.map(p => p.id), [1, 2, 3, 4, 5]);
    assert.equal(result.invalidOrder, true);
});

test('round trips repeat their endpoint, exclude other dates, and tolerate an empty route', () => {
    const places = [place(1, {visit_date: null}), place(2), place(3), place(4, {visit_date: '2026-10-09'})];
    assert.deepEqual(fallbackRoute(places, date, 1, 1).places.map(p => p.id), [1, 2, 3, 1]);
    assert.deepEqual(fallbackRoute([], date).places, []);
});

test('routing key ignores checklist/name edits but tracks constraints and coordinates', () => {
    const p = place(1);
    assert.equal(routingKeyFor([p]), routingKeyFor([{...p, name: 'Renamed', tasks: [{id:'task', done:true}]}]));
    for (const update of [{lat:36}, {stay_minutes:60}, {required_order:2}, {required_time:'12:00'}, {visit_date:null}]) {
        assert.notEqual(routingKeyFor([p]), routingKeyFor([{...p, ...update}]));
    }
});

test('saved places prioritize selected date and calculated route order without changing source', () => {
    const places = [place(1, {visit_date:null}), place(2), place(3), place(4, {visit_date:'2026-10-09'})];
    assert.deepEqual(orderedPlacesFor(places, date, {places:[places[2], places[1]]}).map(p => p.id), [3, 2, 4, 1]);
    assert.deepEqual(places.map(p => p.id), [1, 2, 3, 4]);
});

test('calendar includes empty named sections and selected dates, deduplicated and sorted', () => {
    assert.deepEqual(plannerDates([place(1), place(2, {visit_date:null})], [{visit_date:'2026-10-09'}], {'2026-10-07':'Day'}, '2026-10-08'),
        ['2026-10-07', '2026-10-08', '2026-10-09']);
});

test('moving/deleting a day scopes preferences to that date and all of its sections', () => {
    const entries = {[date]: 'default', [`${date}:7`]: 'morning', '2026-10-09': 'other', [`${date}0`]: 'unrelated'};
    const before = {...entries};
    assert.deepEqual(moveDayEntries(entries, date, '2026-10-10'), {
        '2026-10-10':'default', '2026-10-10:7':'morning', '2026-10-09':'other', [`${date}0`]:'unrelated',
    });
    assert.deepEqual(removeDayEntries(entries, date), {'2026-10-09':'other', [`${date}0`]:'unrelated'});
    assert.deepEqual(entries, before);
});

test('saved place search combines name/area/address and status/date filters without mutation', async () => {
    const { filterSavedPlaces } = await import('../src/lib/planner.ts');
    const places = [place(1, {name:'Tokyo cafe', area:'Shibuya', address:'Station', visit_status:'visited'}), place(2, {name:'Museum', area:'Ueno', address:'Park', visit_date:null}), place(3, {name:'Tokyo hotel', area:'Shibuya', address:'Road', visit_status:'skipped'})];
    assert.deepEqual(filterSavedPlaces(places, ' SHIBUYA ', 'visited').map(p => p.id), [1]);
    assert.deepEqual(filterSavedPlaces(places, 'park', 'unscheduled').map(p => p.id), [2]);
    assert.deepEqual(filterSavedPlaces(places, '', 'pending').map(p => p.id), [2]);
    assert.deepEqual(filterSavedPlaces(places, 'tokyo', 'scheduled').map(p => p.id), [1,3]);
    assert.equal(places.length, 3);
});

test('visit status changes do not change routing input', () => {
    assert.equal(routingKeyFor([place(1)]), routingKeyFor([place(1, {visit_status:'visited'})]));
    assert.equal(routingKeyFor([place(1)]), routingKeyFor([place(1, {visit_status:'skipped'})]));
});
