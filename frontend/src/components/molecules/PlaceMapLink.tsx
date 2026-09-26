import { Link2 } from 'lucide-react';
import type { MapPlace } from '../../lib/types';

export function PlaceMapLink({ place }: { place: MapPlace }) {
    const params = new URLSearchParams({ api: '1', query: `${place.lat},${place.lng}` });
    if (place.google_place_id) params.set('query_place_id', place.google_place_id);
    return (
        <a
            className="place-map-link"
            href={ `https://www.google.com/maps/search/?${params}` }
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ `${place.name ?? '장소'} Google 지도에서 열기` }
            title="Google 지도에서 열기"
        >
            <Link2 size={ 15 } />
        </a>
    );
}
