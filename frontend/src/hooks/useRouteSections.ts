import { t } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { api, json } from '../lib/api';
import type { RouteSection } from '../lib/types';

export function useRouteSections(
    date: string,
    sections: RouteSection[],
    names: Record<string, string>,
    runMutation: (action: () => Promise<unknown>) => Promise<void>,
) {
    useTranslation();
    const [selection, setSelection] = useState<{ date: string; id: number | null }>({
        date,
        id: null,
    });
    useEffect(() => {
        setSelection((previous) => (previous.date === date ? previous : { date, id: null }));
    }, [date]);
    const sectionId =
        selection.date === date &&
        sections.some((s) => s.id === selection.id && s.visit_date === date)
            ? selection.id
            : null;
    const daySections = sections.filter((s) => s.visit_date === date);
    const defaultSectionName = names[date] ?? t('section.defaultName');
    function selectSection(targetDate: string, id: number | null) {
        setSelection({ date: targetDate, id });
    }
    function setSectionId(id: number | null) {
        selectSection(date, id);
    }
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
    return {
        sectionId,
        daySections,
        defaultSectionName,
        setSectionId,
        selectSection,
        saveSection,
        deleteSection,
    };
}
