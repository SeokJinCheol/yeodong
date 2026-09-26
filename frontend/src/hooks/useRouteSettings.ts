import { useEffect, useState } from 'react';
import type { CopyItineraryResult, Place } from '../lib/types';
import { moveDayEntries, removeDayEntries } from '../lib/planner';

type Endpoints = { start: number; end: number };
type TimeSettings = { departureTime: string; timeZone: string };
export function useRouteSettings(places: Place[], date: string, sectionId: number | null) {
    const sectionKey = sectionId === null ? date : `${date}:${sectionId}`;
    const [endpoints, setEndpoints] = useState<Record<string, Endpoints>>(() => {
        try {
            const value = JSON.parse(localStorage.getItem('yeodong-endpoints') || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch {
            return {};
        }
    });
    const [sectionTimes, setSectionTimes] = useState<Record<string, TimeSettings>>({});
    const { departureTime, timeZone } = sectionTimes[sectionKey] ?? {
        departureTime: '09:00',
        timeZone: 'Asia/Tokyo',
    };
    const selected = endpoints[sectionKey],
        dayPlaces = places.filter((p) => p.visit_date === date);
    const start =
        selected && places.some((p) => p.id === selected.start) ? selected.start : dayPlaces[0]?.id;
    const end =
        selected && places.some((p) => p.id === selected.end) ? selected.end : dayPlaces.at(-1)?.id;
    useEffect(() => {
        if (
            start !== undefined &&
            end !== undefined &&
            (selected?.start !== start || selected?.end !== end)
        ) {
            setEndpoints((previous) => ({ ...previous, [sectionKey]: { start, end } }));
        }
    }, [sectionKey, start, end, selected]);
    useEffect(() => {
        try {
            localStorage.setItem('yeodong-endpoints', JSON.stringify(endpoints));
        } catch {
            /* Storage may be unavailable in private browsing. */
        }
    }, [endpoints]);
    function setEndpoint(value: Endpoints) {
        setEndpoints((previous) => ({ ...previous, [sectionKey]: value }));
    }
    function setDepartureTime(value: string) {
        setSectionTimes((previous) => ({
            ...previous,
            [sectionKey]: { departureTime: value, timeZone },
        }));
    }
    function setTimeZone(value: string) {
        setSectionTimes((previous) => ({
            ...previous,
            [sectionKey]: { departureTime, timeZone: value },
        }));
    }
    function removeSection() {
        setEndpoints((previous) => {
            const next = { ...previous };
            delete next[sectionKey];
            return next;
        });
        setSectionTimes((previous) => {
            const next = { ...previous };
            delete next[sectionKey];
            return next;
        });
    }
    function moveDay(target: string) {
        setEndpoints((previous) => moveDayEntries(previous, date, target));
        setSectionTimes((previous) => moveDayEntries(previous, date, target));
    }
    function copySection(result: CopyItineraryResult) {
        const key =
            result.section_id === null
                ? result.target_date
                : `${result.target_date}:${result.section_id}`;
        const copiedStart = start === undefined ? undefined : result.place_id_map[start];
        const copiedEnd = end === undefined ? undefined : result.place_id_map[end];
        if (copiedStart !== undefined && copiedEnd !== undefined) {
            setEndpoints((previous) => ({
                ...previous,
                [key]: { start: copiedStart, end: copiedEnd },
            }));
        }
        setSectionTimes((previous) => ({ ...previous, [key]: { departureTime, timeZone } }));
    }
    function removeDay(deletedIds: Set<number>) {
        setEndpoints((previous) =>
            Object.fromEntries(
                Object.entries(removeDayEntries(previous, date)).filter(
                    ([, value]) => !deletedIds.has(value.start) && !deletedIds.has(value.end),
                ),
            ),
        );
        setSectionTimes((previous) => removeDayEntries(previous, date));
    }
    return {
        start,
        end,
        departureTime,
        timeZone,
        setEndpoint,
        setDepartureTime,
        setTimeZone,
        removeSection,
        moveDay,
        copySection,
        removeDay,
    };
}
