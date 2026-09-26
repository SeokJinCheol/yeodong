import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import type { Place } from '../../lib/types';

export function TransitFallback({ places }: { places: Place[] }) {
    useTranslation();
    return (
        <section className="transit-fallback">
            <h3>
                {
                    t('transit.fallback.title')
                }
            </h3>
            <p>
                {
                    t('transit.fallback.description')
                }
            </p>
            {
                places.slice(0, -1).map((place, i) => {
                    const next = places[i + 1];
                    const params = new URLSearchParams({
                        api: '1',
                        origin: `${place.lat},${place.lng}`,
                        destination: `${next.lat},${next.lng}`,
                        travelmode: 'transit',
                    });
                    if (place.google_place_id) params.set('origin_place_id', place.google_place_id);
                    if (next.google_place_id) params.set('destination_place_id', next.google_place_id);
                    return (
                        <a
                            key={ i }
                            target="_blank"
                            rel="noreferrer"
                            href={ `https://www.google.com/maps/dir/?${params}` }
                        >
                            {
                                place.name
                            }
                            { ' → ' }
                            {
                                next.name
                            }
                            <span>
                                {
                                    t('transit.button.find')
                                }
                            </span>
                        </a>
                    );
                })
            }
        </section>
    );
}
