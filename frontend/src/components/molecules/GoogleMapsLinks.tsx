import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import type { Plan } from '../../lib/types';
import { mapsLinks } from '../../lib/mapsUrl';

export function GoogleMapsLinks({ plan }: { plan: Plan }) {
    useTranslation();
    const links = mapsLinks(plan.places, plan.mode);
    return (
        <section
            className="transit-fallback"
            aria-label={ t('maps.export.label') }
        >
            <h3>
                {
                    t('maps.export.open')
                }
            </h3>
            <p>
                {
                    t('maps.export.description')
                }
            </p>
            {
                links.length > 1 && <p>
                    {
                        t('maps.export.splitNotice')
                    }
                </p>
            }
            {
                links.map(({ url, start, end }, i) => (
                    <a
                        key={ i }
                        href={ url }
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {
                            links.length > 1 ? `${i + 1}. ` : ''
                        }
                        {
                            plan.places[start].name
                        }
                        { ' → ' }
                        {
                            plan.places[end].name
                        }
                        <span>
                            {
                                t('maps.button.openRoute')
                            }
                        </span>
                    </a>
                ))
            }
        </section>
    );
}
