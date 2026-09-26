import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { Place, VisitStatus } from '../../lib/types';

export function VisitStatusControl({
    place,
    busy,
    onChange,
}: {
    place: Place;
    busy: boolean;
    onChange: (place: Place, status: VisitStatus) => void;
}) {
    useTranslation();
    const [expanded, setExpanded] = useState(false);
    const status = place.visit_status ?? 'pending';
    return (
        <div
            className="visit-status"
            data-status={ status }
        >
            <select
                aria-label={ t('place.visitStatus.label', { name: place.name }) }
                value={ status }
                disabled={ busy }
                onChange={ (e) => {
                    setExpanded(false);
                    onChange(place, e.target.value as VisitStatus);
                } }
            >
                <option value="pending">
                    {
                        t('place.visitStatus.pending')
                    }
                </option>
                <option value="visited">
                    {
                        t('place.visitStatus.visited')
                    }
                </option>
                <option value="skipped">
                    {
                        t('place.visitStatus.skip')
                    }
                </option>
            </select>
            {
                status !== 'pending' && (
                    <button
                        type="button"
                        className="visit-toggle"
                        aria-expanded={ expanded }
                        onClick={ () => setExpanded(!expanded) }
                    >
                        {
                            expanded ? t('common.button.hideDetails') : t('common.button.showDetails')
                        }
                    </button>
                )
            }
        </div>
    );
}
