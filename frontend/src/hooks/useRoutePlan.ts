import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, json } from '../lib/api';
import { routingKeyFor } from '../lib/planner';
import type { Mode, Place, Plan } from '../lib/types';

interface RoutePlanOptions {
    places: Place[];
    allPlaces: Place[];
    date: string;
    sectionId: number | null;
    start?: number;
    end?: number;
    departureTime: string;
    timeZone: string;
    setError: (message: string) => void;
}
export function useRoutePlan({
    places,
    allPlaces,
    date,
    sectionId,
    start,
    end,
    departureTime,
    timeZone,
    setError,
}: RoutePlanOptions) {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [mode, setMode] = useState<Mode>('WALK'),
        [orderOnly, setOrderOnly] = useState(true);
    const [busy, setBusy] = useState(false),
        [revision, setRevision] = useState(0);
    const [calculatedTime, setCalculatedTime] = useState('');
    const [unavailableModes, setUnavailableModes] = useState<
        Record<string, Partial<Record<Mode, string>>>
    >({});
    const generation = useRef(0),
        refreshRequested = useRef(false);
    const timeSettings = useRef({ departureTime, timeZone });
    timeSettings.current = { departureTime, timeZone };
    const routingKey = routingKeyFor(places);
    const availabilityKey = JSON.stringify([
        routingKey,
        date,
        sectionId,
        start,
        end,
        departureTime,
        timeZone,
    ]);
    const unavailable = unavailableModes[availabilityKey] ?? {};
    function recalculate() {
        refreshRequested.current = true;
        setRevision((x) => x + 1);
    }
    function reset() {
        generation.current++;
        setPlan(null);
        setBusy(false);
        refreshRequested.current = false;
        setUnavailableModes({});
    }
    // Time edits intentionally do not trigger a request until the user recalculates.
    useEffect(() => {
        const seq = ++generation.current;
        setPlan(null);
        if (orderOnly) {
            setBusy(false);
            setError('');
            return;
        }
        if (!date || start === undefined || end === undefined) {
            setBusy(false);
            return;
        }
        if (unavailable[mode] && !refreshRequested.current) {
            setError(unavailable[mode]!);
            setBusy(false);
            return;
        }
        setBusy(true);
        setError('');
        const requestedTime = { ...timeSettings.current };
        const timer = setTimeout(() => {
            const forceRefresh = refreshRequested.current;
            refreshRequested.current = false;
            api<Plan>(
                '/plan',
                json('POST', {
                    force_refresh: forceRefresh,
                    visit_date: date,
                    section_id: sectionId,
                    start_id: start,
                    end_id: end,
                    mode,
                    departure_time: requestedTime.departureTime,
                    time_zone: requestedTime.timeZone,
                }),
            )
                .then((p) => {
                    if (seq === generation.current) {
                        setPlan(p);
                        setUnavailableModes((previous) => ({
                            ...previous,
                            [availabilityKey]: { ...previous[availabilityKey], [mode]: undefined },
                        }));
                        setCalculatedTime(
                            `${requestedTime.departureTime}|${requestedTime.timeZone}`,
                        );
                    }
                })
                .catch((e) => {
                    if (seq === generation.current) {
                        setError(e.message);
                        if (e instanceof ApiError && e.routeUnavailable)
                            setUnavailableModes((previous) => ({
                                ...previous,
                                [availabilityKey]: {
                                    ...previous[availabilityKey],
                                    [mode]: e.message,
                                },
                            }));
                    }
                })
                .finally(() => {
                    if (seq === generation.current) setBusy(false);
                });
        }, 350);
        return () => {
            clearTimeout(timer);
            generation.current++;
        };
    }, [routingKey, date, sectionId, start, end, mode, revision, orderOnly]);

    // Keep notes/checklists fresh without recalculating a route for non-routing edits.
    const currentPlan = useMemo(
        () =>
            plan
                ? {
                      ...plan,
                      places: plan.places.map(
                          (old) => allPlaces.find((p) => p.id === old.id) ?? old,
                      ),
                  }
                : null,
        [plan, allPlaces],
    );
    return {
        plan: currentPlan,
        mode,
        setMode,
        orderOnly,
        setOrderOnly,
        busy,
        calculatedTime,
        unavailable,
        recalculate,
        reset,
    };
}
