import { t } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { activeTripId, api, json } from '../lib/api';
import type {
    CopyItineraryResult,
    Course,
    Place,
    RouteSection,
    RoutePreferences,
    TrashItem,
    VisitStatus,
} from '../lib/types';

export function usePlannerData() {
    useTranslation();
    const [routeSettings, setRouteSettings] = useState<Record<string, RoutePreferences>>({});
    const [trash, setTrash] = useState<TrashItem[]>([]);
    const [undo, setUndo] = useState<TrashItem>();
    const settingsQueue = useRef<Promise<unknown>>(Promise.resolve());
    const [settingsPending, setSettingsPending] = useState(0);
    const [allPlaces, setPlaces] = useState<Place[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [sections, setSections] = useState<RouteSection[]>([]);
    const [defaultSectionNames, setDefaultSectionNames] = useState<Record<string, string>>({});
    const [loaded, setLoaded] = useState(false),
        [live, setLive] = useState(false);
    const [error, setError] = useState(''),
        [mutating, setMutating] = useState(false);
    const load = useCallback(async () => {
        await settingsQueue.current;
        const [p, c, h, s, names, preferences, deleted] = await Promise.all([
            api<Place[]>('/places'),
            api<Course[]>('/courses'),
            api<{ valhalla_enabled: boolean }>('/health'),
            api<RouteSection[]>('/sections'),
            api<Record<string, string>>('/default-sections'),
            api<Record<string, RoutePreferences>>('/route-settings'),
            api<TrashItem[]>('/trash'),
        ]);
        // Migrate existing browser endpoints once, without replacing server settings.
        let migrated = false;
        try {
            migrated = localStorage.getItem('yeodong-endpoints-migrated') === '1';
        } catch {
            /* Storage unavailable. */
        }
        if (activeTripId === 1 && !migrated) {
            let old: Record<string, { start: number; end: number }> = {};
            try {
                old = JSON.parse(localStorage.getItem('yeodong-endpoints') || '{}');
            } catch {
                /* No migration. */
            }
            for (const [key, endpoints] of Object.entries(old || {})) {
                if (preferences[key] || !/^\d{4}-\d{2}-\d{2}(:\d+)?$/.test(key) || !endpoints)
                    continue;
                const section = key.includes(':') ? Number(key.split(':')[1]) : null;
                if (
                    section !== null &&
                    !s.some((item) => item.id === section && item.visit_date === key.slice(0, 10))
                )
                    continue;
                if (
                    ![endpoints.start, endpoints.end].every((id) =>
                        p.some(
                            (place) => place.id === id && (place.section_id ?? null) === section,
                        ),
                    )
                )
                    continue;
                preferences[key] = await api<RoutePreferences>(
                    `/route-settings/${key}`,
                    json('PATCH', endpoints),
                );
            }
        }
        try {
            if (activeTripId === 1) localStorage.setItem('yeodong-endpoints-migrated', '1');
        } catch {
            /* Storage unavailable. */
        }
        setRouteSettings(preferences);
        setTrash(deleted);
        setPlaces(p);
        setCourses(c);
        setSections(s);
        setDefaultSectionNames(names);
        setLive(h.valhalla_enabled);
        setLoaded(true);
    }, []);
    useEffect(() => {
        load().catch((e) => setError(e.message));
    }, [load]);

    // Throwing is intentional: dialogs close only after a successful mutation.
    async function runMutation(action: () => Promise<unknown>) {
        setMutating(true);
        setError('');
        try {
            await settingsQueue.current;
            await action();
            await load();
        } catch (e) {
            setError((e as Error).message);
            throw e;
        } finally {
            setMutating(false);
        }
    }
    async function mutate(action: () => Promise<unknown>) {
        try {
            await runMutation(action);
        } catch {
            /* Error is displayed by the page. */
        }
    }
    function updateChecklist(updated: Place) {
        setPlaces((previous) => previous.map((p) => (p.id === updated.id ? updated : p)));
    }
    function deletePlace(id: number) {
        return mutate(async () => {
            await api(`/places/${id}`, { method: 'DELETE' });
            await captureUndo();
        });
    }
    async function captureUndo() {
        const items = await api<TrashItem[]>('/trash');
        setUndo(items[0]);
    }
    async function restoreTrash(id: number) {
        await runMutation(() => api(`/trash/${id}/restore`, { method: 'POST' }));
        setUndo(undefined);
    }
    function savePreferences(key: string, patch: Partial<RoutePreferences>) {
        setRouteSettings((previous) => ({
            ...previous,
            [key]: {
                ...(previous[key] ?? {
                    start: null,
                    end: null,
                    departureTime: '09:00',
                    timeZone: 'Asia/Tokyo',
                    mode: 'MAP',
                    orderMode: 'auto',
                }),
                ...patch,
            },
        }));
        setSettingsPending((n) => n + 1);
        const request = settingsQueue.current.then(() =>
            api<RoutePreferences>(`/route-settings/${key}`, json('PATCH', patch)),
        );
        settingsQueue.current = request
            .catch((e) => {
                setError(t('settings.error.save', { message: e.message }));
            })
            .finally(() => setSettingsPending((n) => n - 1));
        return request;
    }
    function setVisitStatus(place: Place, status: VisitStatus) {
        return mutate(async () =>
            updateChecklist(
                await api<Place>(`/places/${place.id}/visit-status`, json('PATCH', { status })),
            ),
        );
    }
    function changePlaceDate(place: Place, value: string) {
        return mutate(() =>
            api(
                `/places/${place.id}`,
                json('PUT', {
                    ...place,
                    visit_date: value || null,
                    section_id: value === place.visit_date ? place.section_id : null,
                }),
            ),
        );
    }
    function assignCourse(course: Course, date: string, sectionId: number | null) {
        return mutate(() =>
            api(
                '/courses/assign',
                json('POST', {
                    place_ids: course.places.map((p) => p.id),
                    visit_date: date,
                    section_id: sectionId,
                }),
            ),
        );
    }
    function removeDay(date: string) {
        setPlaces((previous) => previous.filter((p) => p.visit_date !== date));
        setSections((previous) => previous.filter((s) => s.visit_date !== date));
        setDefaultSectionNames((previous) => {
            const next = { ...previous };
            delete next[date];
            return next;
        });
    }
    async function copyItinerary(payload: {
        source_date: string;
        target_date: string;
        section_id: number | null;
        start_id?: number;
        end_id?: number;
    }) {
        let result: CopyItineraryResult | undefined;
        await runMutation(async () => {
            result = await api<CopyItineraryResult>('/itineraries/copy', json('POST', payload));
        });
        return result!;
    }
    return {
        routeSettings,
        savePreferences,
        settingsPending,
        trash,
        undo,
        setUndo,
        captureUndo,
        restoreTrash,
        setVisitStatus,
        allPlaces,
        courses,
        sections,
        defaultSectionNames,
        loaded,
        live,
        error,
        setError,
        mutating,
        load,
        runMutation,
        mutate,
        updateChecklist,
        removeDay,
        deletePlace,
        changePlaceDate,
        assignCourse,
        copyItinerary,
    };
}
