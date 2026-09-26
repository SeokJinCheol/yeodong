import type { Place, Plan, RouteSection } from './types';

export function plannerDates(
    places: Place[],
    sections: RouteSection[],
    names: Record<string, string>,
    selected = '',
) {
    return [
        ...new Set([
            ...(selected ? [selected] : []),
            ...places.flatMap((p) => (p.visit_date ? [p.visit_date] : [])),
            ...sections.map((s) => s.visit_date),
            ...Object.keys(names),
        ]),
    ].sort();
}

export function routingKeyFor(places: Place[]) {
    return JSON.stringify(
        places.map(({ id, lat, lng, visit_date, stay_minutes, required_order, required_time }) => ({
            id,
            lat,
            lng,
            visit_date,
            stay_minutes,
            required_order,
            required_time,
        })),
    );
}

export function fallbackRoute(places: Place[], date: string, start?: number, end?: number) {
    const middlePlaces = places.filter(
        (p) => p.visit_date === date && p.id !== start && p.id !== end,
    );
    const slots: Array<Place | undefined> = Array(middlePlaces.length).fill(undefined);
    const unplaced: Place[] = [];
    middlePlaces.forEach((p) => {
        const slot = (p.required_order ?? 0) - 1;
        if (slot >= 0 && slot < slots.length && !slots[slot]) slots[slot] = p;
        else unplaced.push(p);
    });
    const first = places.find((p) => p.id === start),
        last = places.find((p) => p.id === end);
    return {
        places: [
            ...(first ? [first] : []),
            ...slots.map((p) => p ?? unplaced.shift()!),
            ...(last ? [last] : []),
        ],
        middleCount: middlePlaces.length,
        invalidOrder: middlePlaces.some(
            (p) => p.required_order && p.required_order > middlePlaces.length,
        ),
    };
}

export function orderedPlacesFor(places: Place[], date: string, plan: Plan | null) {
    return [...places].sort((a, b) => {
        if (a.visit_date === date && b.visit_date !== date) return -1;
        if (b.visit_date === date && a.visit_date !== date) return 1;
        if (a.visit_date === date && b.visit_date === date && plan) {
            const ai = plan.places.findIndex((p) => p.id === a.id),
                bi = plan.places.findIndex((p) => p.id === b.id);
            if (ai >= 0 && bi >= 0) return ai - bi;
        }
        return (
            (a.visit_date ?? '9999').localeCompare(b.visit_date ?? '9999') ||
            (a.required_order ?? 101) - (b.required_order ?? 101) ||
            a.id - b.id
        );
    });
}

export function removeDayEntries<T>(entries: Record<string, T>, date: string) {
    return Object.fromEntries(
        Object.entries(entries).filter(([key]) => key !== date && !key.startsWith(`${date}:`)),
    );
}

export function moveDayEntries<T>(entries: Record<string, T>, date: string, target: string) {
    const next = { ...entries };
    Object.keys(entries)
        .filter((key) => key === date || key.startsWith(`${date}:`))
        .forEach((key) => {
            next[target + key.slice(date.length)] = entries[key];
            delete next[key];
        });
    return next;
}
