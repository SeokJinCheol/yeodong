import { useEffect, useState } from 'react';
import { api, json } from '../lib/api';
import type { RouteSection } from '../lib/types';

export function useRouteSections(
    date: string,
    sections: RouteSection[],
    names: Record<string, string>,
    runMutation: (action: () => Promise<unknown>) => Promise<void>,
) {
    const [chosenSectionId, setSectionId] = useState<number | null>(null);
    const sectionId = sections.some((s) => s.id === chosenSectionId && s.visit_date === date)
        ? chosenSectionId
        : null;
    const daySections = sections.filter((s) => s.visit_date === date);
    const defaultSectionName = names[date] ?? '기본 동선';
    useEffect(() => {
        setSectionId(null);
    }, [date]);
    async function saveSection(action: 'add' | 'rename', name: string) {
        let savedId: number | null = null;
        await runMutation(async () => {
            const saved = await api<{ id: number | null }>(
                action === 'add'
                    ? '/sections'
                    : sectionId === null
                      ? '/default-sections'
                      : `/sections/${sectionId}`,
                json(action === 'add' ? 'POST' : 'PUT', { name: name.trim(), visit_date: date }),
            );
            savedId = saved.id;
        });
        setSectionId(savedId);
    }
    async function deleteSection(onDeleted: () => void) {
        await runMutation(async () => {
            await api(`/sections/${sectionId}`, { method: 'DELETE' });
            onDeleted();
        });
        setSectionId(null);
    }
    return { sectionId, daySections, defaultSectionName, setSectionId, saveSection, deleteSection };
}
