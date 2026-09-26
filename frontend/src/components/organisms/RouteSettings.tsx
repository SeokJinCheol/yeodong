import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { ArrowDownUp } from 'lucide-react';
import type { Place } from '../../lib/types';
interface Props {
    places: Place[];
    start?: number;
    end?: number;
    departureTime: string;
    timeZone: string;
    setDepartureTime: (value: string) => void;
    setTimeZone: (value: string) => void;
    onEndpointsChange: (value: { start: number; end: number }) => void;
    onSwap: () => void;
    hasPlan: boolean;
    calculatedTime: string;
    busy: boolean;
    orderOnly: boolean;
    mutating: boolean;
    recalculate: () => void;
}
export function RouteSettings({
    places,
    start,
    end,
    departureTime,
    timeZone,
    setDepartureTime,
    setTimeZone,
    onEndpointsChange,
    onSwap,
    hasPlan,
    calculatedTime,
    busy,
    orderOnly,
    mutating,
    recalculate,
}: Props) {
    useTranslation();
    return (
        <>
            <div className="transit-settings">
                <label>
                    {
                        t('route.settings.departureTime')
                    }
                    <input
                        aria-label={ t('route.settings.departureTime') }
                        type="time"
                        required
                        value={ departureTime }
                        onChange={ (e) => {
                            if (e.target.value) setDepartureTime(e.target.value);
                        } }
                    />
                </label>
                <label>
                    {
                        t('common.label.timeZone')
                    }
                    <select
                        aria-label={ t('route.settings.timeZone') }
                        value={ timeZone }
                        onChange={ (e) => setTimeZone(e.target.value) }
                    >
                        <option value="Asia/Tokyo">
                            {
                                t('common.timeZone.tokyo')
                            }
                        </option>
                        <option value="Asia/Seoul">
                            {
                                t('common.timeZone.seoul')
                            }
                        </option>
                        <option value="Asia/Taipei">
                            {
                                t('common.timeZone.taipei')
                            }
                        </option>
                        <option value="Asia/Singapore">
                            {
                                t('common.timeZone.singapore')
                            }
                        </option>
                        <option value="Europe/Paris">
                            {
                                t('common.timeZone.paris')
                            }
                        </option>
                        <option value="Europe/London">
                            {
                                t('common.timeZone.london')
                            }
                        </option>
                        <option value="America/New_York">
                            {
                                t('common.timeZone.newYork')
                            }
                        </option>
                        <option value="America/Los_Angeles">
                            {
                                t('common.timeZone.losAngeles')
                            }
                        </option>
                    </select>
                </label>
                <p>
                    {
                        t('route.settings.manualRecalculationHint')
                    }
                </p>
            </div>
            {
                hasPlan && calculatedTime !== `${departureTime}|${timeZone}` && (
                    <div
                        className="time-pending"
                        role="status"
                    >
                        {
                            t('route.settings.timeChanged')
                        }
                        <button
                            type="button"
                            className="text-button"
                            disabled={ busy || orderOnly }
                            onClick={ recalculate }
                        >
                            {
                                t('route.button.recalculateTime')
                            }
                        </button>
                    </div>
                )
            }
            <div className="endpoint-selectors">
                <label>
                    <span className="endpoint-dot" />
                    {
                        t('route.label.start')
                    }
                    <select
                        aria-label={ t('route.settings.start') }
                        value={ start ?? '' }
                        onChange={ (e) =>
                            onEndpointsChange({
                                start: Number(e.target.value),
                                end: end ?? Number(e.target.value),
                            })
                        }
                    >
                        <option
                            value=""
                            disabled
                        >
                            {
                                t('route.settings.selectStart')
                            }
                        </option>
                        {
                            places.map((p) => (
                                <option
                                    value={ p.id }
                                    key={ p.id }
                                >
                                    {
                                        p.name
                                    }
                                </option>
                            ))
                        }
                    </select>
                </label>
                <button
                    type="button"
                    className="swap-endpoints"
                    aria-label={ t('route.settings.swapEndpoints') }
                    title={ t('route.settings.swapEndpoints') }
                    disabled={ mutating || start === undefined || end === undefined || start === end }
                    onClick={ () => {
                        if (start === undefined || end === undefined) return;
                        onEndpointsChange({ start: end, end: start });
                        onSwap();
                    } }
                >
                    <ArrowDownUp size={ 15 } />
                </button>
                <label>
                    <span className="endpoint-dot end" />
                    {
                        t('route.label.arrival')
                    }
                    <select
                        aria-label={ t('route.settings.end') }
                        value={ end ?? '' }
                        onChange={ (e) =>
                            onEndpointsChange({
                                start: start ?? Number(e.target.value),
                                end: Number(e.target.value),
                            })
                        }
                    >
                        <option
                            value=""
                            disabled
                        >
                            {
                                t('route.settings.selectEnd')
                            }
                        </option>
                        {
                            places.map((p) => (
                                <option
                                    value={ p.id }
                                    key={ p.id }
                                >
                                    {
                                        p.name
                                    }
                                </option>
                            ))
                        }
                    </select>
                </label>
            </div>
        </>
    );
}
