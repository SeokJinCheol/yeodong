import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import type { MapPlace } from '../../lib/types';

export function PlaceMapLink({ place }: { place: MapPlace }) {
    useTranslation();
    const params = new URLSearchParams({ api: '1', query: `${place.lat},${place.lng}` });
    if (place.google_place_id) params.set('query_place_id', place.google_place_id);
    return (
        <a
            className="place-map-link"
            href={ `https://www.google.com/maps/search/?${params}` }
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ t('maps.link.place', { name: place.name ?? t('common.label.place') }) }
            title={ t('maps.button.openPlace') }
        >
            <Link2 size={ 15 } />
        </a>
    );
}
