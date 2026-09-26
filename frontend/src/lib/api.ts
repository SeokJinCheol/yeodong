import { t } from './i18n';
import type { Trip } from './types';
export let activeTripId = 1;
let accountId: number | null = null;
let csrfToken = '';
export function configureAccount(id: number | null, csrf: string, trips: Trip[]) {
    accountId = id;
    csrfToken = csrf;
    let remembered = 0;
    try {
        remembered = Number(localStorage.getItem(`yeodong-trip-user-${id}`));
    } catch {
        /* Storage unavailable. */
    }
    activeTripId = trips.find((trip) => trip.id === remembered)?.id ?? trips[0]?.id ?? 1;
}
export function switchTrip(id: number) {
    localStorage.setItem(`yeodong-trip-user-${accountId}`, String(id));
    window.location.reload();
}
export class ApiError extends Error {
    constructor(
        message: string,
        public routeUnavailable: boolean = false,
        public status: number = 0,
    ) {
        super(message);
    }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${import.meta.env.BASE_URL}api${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'yeodong',
            'X-CSRF-Token': csrfToken,
            ...(accountId !== null && !['/auth/login', '/auth/register', '/auth/me'].includes(path)
                ? { 'X-Account-ID': String(accountId) }
                : {}),
            'X-Trip-ID': String(activeTripId),
            ...init?.headers,
        },
    });
    if (!response.ok) {
        if (response.status === 401 && !path.startsWith('/auth/'))
            window.dispatchEvent(new Event('account-expired'));
        const data = await response.json().catch(() => null);
        throw new ApiError(
            typeof data?.detail === 'string'
                ? data.detail
                : t('common.error.requestFailed', { status: response.status }),
            response.headers.get('X-Route-Unavailable') === 'true',
            response.status,
        );
    }
    return response.status === 204 ? (undefined as T) : response.json();
}
export const json = (method: string, data: unknown): RequestInit => ({
    method,
    body: JSON.stringify(data),
});
export function minutes(value: number) {
    const n = Math.round(value);
    if (n < 60) return t('common.duration.minutes', { minutes: n });
    const hours = Math.floor(n / 60),
        remainder = n % 60;
    return remainder
        ? t('common.duration.hoursMinutes', { hours, minutes: remainder })
        : t('common.duration.hours', { hours });
}
export function localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
