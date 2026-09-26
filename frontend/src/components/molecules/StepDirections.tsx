import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ExternalLink } from 'lucide-react';
import type { MapPlace, Mode } from '../../lib/types';
import { mapsLinks } from '../../lib/mapsUrl';

export function StepDirections({ from, to, mode }: { from: MapPlace; to: MapPlace; mode: Mode }) {
    useTranslation();
    const [{ url }] = mapsLinks([from, to], mode);
    return (
        <div className="step-directions">
            <ArrowDown size={ 14 } />
            <a
                href={ url }
                target="_blank"
                rel="noopener noreferrer"
                aria-label={ t('maps.link.directions', {
                    from: from.name,
                    to: to.name,
                }) }
            >
                <span>
                    {
                        t('maps.button.openRouteLabel')
                    }
                    <ExternalLink size={ 13 } />
                </span>
                <small>
                    {
                        t('maps.directionsMode', {
                            mode:
                                mode === 'WALK'
                                    ? t('route.mode.walk')
                                    : mode === 'DRIVE'
                                        ? t('route.mode.drive')
                                        : t('route.mode.transit'),
                        })
                    }
                </small>
            </a>
        </div>
    );
}
