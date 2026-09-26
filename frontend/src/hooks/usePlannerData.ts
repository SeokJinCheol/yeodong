import { useCallback, useEffect, useState } from 'react';
import { api, json } from '../lib/api';
import type { CopyItineraryResult, Course, Place, RouteSection } from '../lib/types';

export function usePlannerData() {
    const [allPlaces, setPlaces] = useState<Place[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [sections, setSections] = useState<RouteSection[]>([]);
    const [defaultSectionNames, setDefaultSectionNames] = useState<Record<string, string>>({});
    const [loaded, setLoaded] = useState(false),
        [live, setLive] = useState(false);
    const [error, setError] = useState(''),
        [mutating, setMutating] = useState(false);
    const load = useCallback(async () => {
        const [p, c, h, s, names] = await Promise.all([
            api<Place[]>('/places'),
            api<Course[]>('/courses'),
            api<{ valhalla_enabled: boolean }>('/health'),
            api<RouteSection[]>('/sections'),
            api<Record<string, string>>('/default-sections'),
        ]);
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
        return mutate(() => api(`/places/${id}`, { method: 'DELETE' }));
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
