import { t } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { activeTripId, api, json, switchTrip } from '../lib/api';
import type { Trip } from '../lib/types';

export function useTripTools(runMutation: (action: () => Promise<unknown>) => Promise<void>) {
    useTranslation();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        api<Trip[]>('/trips')
            .then(setTrips)
            .catch((e) => setError(e.message));
    }, []);
    async function execute(action: () => Promise<void>) {
        setError('');
        setSuccess('');
        setBusy(true);
        try {
            await action();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    async function saveTrip(name: string, create: boolean) {
        await execute(async () => {
            const trip = await api<Trip>(
                create ? '/trips' : `/trips/${activeTripId}`,
                json(create ? 'POST' : 'PUT', { name: name.trim() }),
            );
            if (create) switchTrip(trip.id);
            else setTrips((previous) => previous.map((t) => (t.id === trip.id ? trip : t)));
        });
    }
    async function download() {
        await execute(async () => {
            const backup = await api<{ name: string }>('/backup');
            const url = URL.createObjectURL(
                new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = `${backup.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}-backup.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }
    async function importFile(file: File) {
        await execute(async () => {
            if (file.size > 2_000_000) throw new Error(t('backup.error.tooLarge'));
            let payload;
            try {
                payload = JSON.parse(await file.text());
            } catch {
                throw new Error(t('backup.error.invalidJson'));
            }
            await runMutation(() => api('/backup/import', json('POST', payload)));
            setSuccess(t('backup.imported'));
        });
    }
    return { trips, error, success, busy, saveTrip, download, importFile };
}
