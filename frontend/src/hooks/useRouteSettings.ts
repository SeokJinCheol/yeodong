import { useAccount } from './useAccount';
import type { Place, RoutePreferences } from '../lib/types';

export function useRouteSettings(
    places: Place[],
    date: string,
    sectionId: number | null,
    preferences: Record<string, RoutePreferences>,
    save: (key: string, patch: Partial<RoutePreferences>) => Promise<unknown>,
) {
    const { user } = useAccount();
    const defaults = user.preferences;
    const key = sectionId === null ? date : `${date}:${sectionId}`;
    const selected = preferences[key];
    const dayPlaces = places.filter((p) => p.visit_date === date);
    const start =
        selected?.start && places.some((p) => p.id === selected.start)
            ? selected.start
            : dayPlaces[0]?.id;
    const end =
        selected?.end && places.some((p) => p.id === selected.end)
            ? selected.end
            : dayPlaces.at(-1)?.id;
    function update(patch: Partial<RoutePreferences>) {
        if (date)
            void save(key, {
                ...defaults,
                ...selected,
                start: start ?? null,
                end: end ?? null,
                ...patch,
            }).catch(() => {
                /* Page displays persistence errors. */
            });
    }
    return {
        start,
        end,
        departureTime: selected?.departureTime ?? defaults.departureTime,
        timeZone: selected?.timeZone ?? defaults.timeZone,
        viewMode: selected?.mode ?? defaults.mode,
        orderMode: selected?.orderMode ?? 'auto',
        setEndpoint: (value: { start: number; end: number }) => update(value),
        setDepartureTime: (departureTime: string) => update({ departureTime }),
        setTimeZone: (timeZone: string) => update({ timeZone }),
        setMode: (mode: RoutePreferences['mode']) => update({ mode }),
    };
}
