import { useEffect, useState } from 'react';
import { activeTripId, api, json, switchTrip } from '../lib/api';
import type { Trip } from '../lib/types';

export function useTripTools(runMutation: (action: () => Promise<unknown>) => Promise<void>) {
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
            if (file.size > 2_000_000)
                throw new Error('백업 파일은 2MB 이하만 가져올 수 있습니다.');
            let payload;
            try {
                payload = JSON.parse(await file.text());
            } catch {
                throw new Error('올바른 JSON 백업 파일을 선택해 주세요.');
            }
            await runMutation(() => api('/backup/import', json('POST', payload)));
            setSuccess('백업을 가져왔습니다. 상단 날짜 탭에서 일정을 선택하세요.');
        });
    }
    return { trips, error, success, busy, saveTrip, download, importFile };
}
