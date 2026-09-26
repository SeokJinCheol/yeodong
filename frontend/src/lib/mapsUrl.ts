import type { MapPlace, Mode } from './types';

// Three intermediate stops also work in mobile browsers. Adjacent links overlap
// at the last stop so splitting never drops a leg of the final itinerary.
export function mapsLinks(places: MapPlace[], mode: Mode) {
    const step = mode === 'TRANSIT' ? 1 : 4;
    const links: { url: string; start: number; end: number }[] = [];
    const coordinate = (p: MapPlace) => `${p.lat},${p.lng}`;
    for (let start = 0; start < places.length - 1; start += step) {
        const end = Math.min(start + step, places.length - 1);
        const stops = places.slice(start, end + 1);
        const params = new URLSearchParams({
            api: '1',
            origin: coordinate(stops[0]),
            destination: coordinate(stops.at(-1)!),
            travelmode: { WALK: 'walking', DRIVE: 'driving', TRANSIT: 'transit' }[mode],
        });
        if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).map(coordinate).join('|'));
        links.push({ url: `https://www.google.com/maps/dir/?${params}`, start, end });
    }
    return links;
}
