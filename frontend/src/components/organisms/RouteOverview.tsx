import { t, locale, translateMessage } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import type { Ref } from 'react';
import { Clock3, MapPin, Route, Sparkles } from 'lucide-react';
import { minutes } from '../../lib/api';
import type { MapPlace, Mode, Place, Plan } from '../../lib/types';
import { StatCard } from '../molecules/StatCard';
import { ModeSwitch } from '../molecules/ModeSwitch';
import { RouteMap } from './RouteMap';
interface Props {
    sectionRef?: Ref<HTMLDivElement>;
    mode: Mode | 'MAP';
    unavailable: Partial<Record<Mode | 'MAP', string>>;
    onModeChange: (mode: Mode | 'MAP') => void;
    plan: Plan | null;
    selectedPlace?: Place;
    fallbackPlaces: Place[];
    busy: boolean;
    onAddPlace: (position: MapPlace) => void;
}
export function RouteOverview({
    sectionRef,
    mode,
    unavailable,
    onModeChange,
    plan,
    selectedPlace,
    fallbackPlaces,
    busy,
    onAddPlace,
}: Props) {
    useTranslation();
    return (
        <div
            className="map-column"
            ref={ sectionRef }
        >
            <div className="map-mode-controls">
                <ModeSwitch
                    value={ mode }
                    unavailable={ unavailable }
                    onChange={ onModeChange }
                />
                {
                    mode === 'MAP' && <p className="map-mode-note">
                        {
                            t('maps.orderNotice')
                        }
                    </p>
                }
                {
                    Object.entries(unavailable)
                        .filter(([, reason]) => reason)
                        .map(([key, reason]) => (
                            <p
                                className="mode-unavailable-note"
                                key={ key }
                            >
                                {
                                    t('route.status.unavailable', {
                                        mode:
                                            key === 'WALK'
                                                ? t('route.mode.walk')
                                                : key === 'DRIVE'
                                                    ? t('route.mode.drive')
                                                    : t('route.mode.transit'),
                                        reason: translateMessage(reason),
                                    })
                                }
                            </p>
                        ))
                }
            </div>
            <div className="stats">
                <StatCard
                    icon={ <Route size={ 15 } /> }
                    label={ t('route.stats.travelTime') }
                    value={ plan ? minutes(plan.total_travel_seconds / 60) : '—' }
                />
                <StatCard
                    icon={ <MapPin size={ 15 } /> }
                    label={ t('route.stats.distance') }
                    value={ plan ? `${(plan.total_distance_meters / 1000).toFixed(1)} km` : '—' }
                />
                <StatCard
                    icon={ <Clock3 size={ 15 } /> }
                    label={ t('route.stats.elapsedTime') }
                    value={ plan ? minutes(plan.total_elapsed_seconds / 60) : '—' }
                />
            </div>
            <RouteMap
                onAddPlace={ onAddPlace }
                plan={ plan }
                selectedPlace={ selectedPlace }
                fallbackPlaces={ !busy ? fallbackPlaces : [] }
            />
            {
                plan && (
                    <p className="schedule-summary">
                        {
                            t('route.stats.scheduleSummary', {
                                wait: minutes(plan.total_wait_seconds / 60),
                                arrival: new Date(plan.schedule.at(-1)!.visit_start).toLocaleString(
                                    locale(),
                                    {
                                        timeZone: plan.time_zone,
                                        month: 'numeric',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                    },
                                ),
                            })
                        }
                    </p>
                )
            }
            <div className="tip">
                <Sparkles size={ 17 } />
                <p>
                    <strong>
                        {
                            t('route.advice.title')
                        }
                    </strong>
                    <br />
                    {
                        plan?.source === 'valhalla'
                            ? t('route.advice.recalculateHint')
                            : t('route.advice.exportHint')
                    }
                </p>
            </div>
        </div>
    );
}
