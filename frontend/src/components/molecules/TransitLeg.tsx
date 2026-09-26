import { t, locale, translateMessage } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { Footprints, TrainFront } from 'lucide-react';
import type { Leg } from '../../lib/types';
import { minutes } from '../../lib/api';

function time(value: string | undefined, zone: string) {
    return value
        ? new Date(value).toLocaleTimeString(locale(), {
            timeZone: zone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        })
        : t('transit.timeUnavailable');
}

export function TransitLeg({ leg, timeZone }: { leg: Leg; timeZone: string }) {
    useTranslation();
    const rides = leg.steps.filter((s) => s.mode === 'TRANSIT');
    return (
        <div className="transit-leg">
            <div className="transit-summary">
                {
                    t('transit.timeRange', {
                        departure: time(leg.departure_time, timeZone),
                        arrival: time(leg.arrival_time, timeZone),
                    })
                }
                <span>
                    {
                        rides.length
                            ? t('transit.transfers', { count: leg.transfer_count })
                            : t('transit.walkOnly')
                    }
                </span>
            </div>
            {
                leg.steps.map((step, i) => (
                    <div
                        className="transit-step"
                        key={ i }
                    >
                        {
                            step.mode === 'TRANSIT' ? <TrainFront size={ 14 } /> : <Footprints size={ 14 } />
                        }
                        <div>
                            {
                                step.mode === 'TRANSIT' ? (
                                    <>
                                        <strong>
                                            {
                                                step.line || step.vehicle
                                            }
                                            {
                                                step.line_name && step.line_name !== step.line
                                                    ? ` · ${step.line_name}`
                                                    : ''
                                            }
                                        </strong>
                                        <p>
                                            {
                                                step.departure_stop
                                            }
                                            { ' → ' }
                                            {
                                                step.arrival_stop
                                            }
                                        </p>
                                        <p>
                                            {
                                                t(
                                                    step.stop_count != null
                                                        ? 'transit.rideWithStops'
                                                        : 'transit.ride',
                                                    {
                                                        departure: time(step.departure_time, timeZone),
                                                        arrival: time(step.arrival_time, timeZone),
                                                        count: step.stop_count ?? 0,
                                                    },
                                                )
                                            }
                                        </p>
                                        {
                                            step.headsign && (
                                                <p>
                                                    {
                                                        t('transit.headsign', { destination: step.headsign })
                                                    }
                                                </p>
                                            )
                                        }
                                        {
                                            step.agencies.map((agency, j) => (
                                                <span
                                                    className="transit-agency"
                                                    key={ j }
                                                >
                                                    {
                                                        /^https?:\/\//.test(agency.url) ? (
                                                            <a
                                                                href={ agency.url }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                {
                                                                    agency.name
                                                                }
                                                            </a>
                                                        ) : (
                                                            agency.name
                                                        )
                                                    }
                                                </span>
                                            ))
                                        }
                                    </>
                                ) : (
                                    <>
                                        <strong>
                                            {
                                                t('transit.walkSummary', {
                                                    duration: minutes(step.duration_seconds / 60),
                                                    distance: step.distance_meters,
                                                })
                                            }
                                        </strong>
                                        <p>
                                            {
                                                step.instruction || t('transit.walkInstruction')
                                            }
                                        </p>
                                    </>
                                )
                            }
                        </div>
                    </div>
                ))
            }
            {
                leg.warnings.map((warning, i) => (
                    <p
                        className="transit-note"
                        key={ i }
                    >
                        {
                            translateMessage(warning)
                        }
                    </p>
                ))
            }
        </div>
    );
}
