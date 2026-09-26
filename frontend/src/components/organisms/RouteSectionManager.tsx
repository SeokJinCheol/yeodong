import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../atoms/Button';
import type { Place, RouteSection } from '../../lib/types';
interface Props {
    date: string;
    sectionId: number | null;
    daySections: RouteSection[];
    defaultSectionName: string;
    allPlaces: Place[];
    placeCount: number;
    mutating: boolean;
    setSectionId: (id: number | null) => void;
    onSave: (action: 'add' | 'rename', name: string) => Promise<void>;
    onDelete: () => Promise<void>;
}
export function RouteSectionManager({
    date,
    sectionId,
    daySections,
    defaultSectionName,
    allPlaces,
    placeCount,
    mutating,
    setSectionId,
    onSave,
    onDelete,
}: Props) {
    useTranslation();
    const [sectionName, setSectionName] = useState('');
    const [managementOpen, setManagementOpen] = useState(false);
    const [sectionAction, setSectionAction] = useState<'add' | 'rename' | 'delete' | null>(null);
    return (
        <section
            className={ `route-sections ${managementOpen ? 'management-open' : ''}` }
            aria-label={ t('section.dailyLabel') }
        >
            <div className="section-toolbar">
                <div
                    className="section-tabs"
                    role="tablist"
                    aria-label={ t('section.label') }
                >
                    {
                        [{ id: null, name: defaultSectionName }, ...daySections].map((section) => (
                            <button
                                key={ section.id ?? 'default' }
                                type="button"
                                role="tab"
                                disabled={ mutating }
                                id={ `section-tab-${section.id ?? 'default'}` }
                                aria-selected={ sectionId === section.id }
                                aria-controls="section-panel"
                                onKeyDown={ (e) => {
                                    const tabs = [null, ...daySections.map((s) => s.id)];
                                    const index = tabs.indexOf(section.id);
                                    const next =
                                        e.key === 'ArrowRight'
                                            ? (index + 1) % tabs.length
                                            : e.key === 'ArrowLeft'
                                                ? (index + tabs.length - 1) % tabs.length
                                                : e.key === 'Home'
                                                    ? 0
                                                    : e.key === 'End'
                                                        ? tabs.length - 1
                                                        : null;
                                    if (next !== null) {
                                        e.preventDefault();
                                        setSectionId(tabs[next]);
                                        setSectionAction(null);
                                        document
                                            .getElementById(`section-tab-${tabs[next] ?? 'default'}`)
                                            ?.focus();
                                    }
                                } }
                                tabIndex={ sectionId === section.id ? 0 : -1 }
                                onClick={ () => {
                                    setSectionId(section.id);
                                    setSectionAction(null);
                                } }
                            >
                                {
                                    section.name
                                }
                                <span>
                                    {

                                        allPlaces.filter(
                                            (p) =>
                                                p.visit_date === date &&
                                                (p.section_id ?? null) === section.id,
                                        ).length

                                    }
                                </span>
                            </button>
                        ))
                    }
                </div>
                <button
                    type="button"
                    className="section-management-toggle"
                    aria-label={ t('section.manageLabel') }
                    aria-expanded={ managementOpen }
                    onClick={ () => {
                        setManagementOpen(!managementOpen);
                        setSectionAction(null);
                    } }
                >
                    {
                        managementOpen ? t('common.button.collapse') : t('common.button.manage')
                    }
                </button>
                <div className="section-actions section-management-actions">
                    <Button
                        variant="secondary"
                        disabled={ mutating }
                        onClick={ () => {
                            setSectionName('');
                            setSectionAction('add');
                        } }
                    >
                        <Plus size={ 15 } />
                        {
                            t('section.button.add')
                        }
                    </Button>
                    <button
                        type="button"
                        className="text-button"
                        disabled={ mutating }
                        onClick={ () => {
                            setSectionName(
                                sectionId === null
                                    ? defaultSectionName
                                    : (daySections.find((s) => s.id === sectionId)?.name ?? ''),
                            );
                            setSectionAction('rename');
                        } }
                    >
                        {
                            t('common.button.rename')
                        }
                    </button>
                    {
                        sectionId !== null && (
                            <button
                                type="button"
                                className="text-button section-delete"
                                disabled={ mutating }
                                onClick={ () => setSectionAction('delete') }
                            >
                                {
                                    t('section.button.delete')
                                }
                            </button>
                        )
                    }
                </div>
            </div>
            {
                (sectionAction === 'add' || sectionAction === 'rename') && (
                    <form
                        className="section-form"
                        onSubmit={ async (e) => {
                            e.preventDefault();
                            try {
                                await onSave(sectionAction, sectionName);
                                setSectionAction(null);
                            } catch {
                                /* Page displays mutation errors. */
                            }
                        } }
                    >
                        <label htmlFor="section-name">
                            {
                                t('section.name')
                            }
                        </label>
                        <input
                            id="section-name"
                            disabled={ mutating }
                            autoFocus
                            aria-label={ t('section.name') }
                            placeholder={ t('section.namePlaceholder') }
                            required
                            maxLength={ 40 }
                            value={ sectionName }
                            onChange={ (e) => setSectionName(e.target.value) }
                        />
                        <Button disabled={ mutating || !sectionName.trim() }>
                            {
                                sectionAction === 'add' ? t('common.button.add') : t('common.button.save')
                            }
                        </Button>
                        <button
                            type="button"
                            className="text-button"
                            onClick={ () => setSectionAction(null) }
                        >
                            {
                                t('common.button.cancel')
                            }
                        </button>
                    </form>
                )
            }
            {
                sectionAction === 'delete' && sectionId !== null && (
                    <div className="section-delete-confirm">
                        <p>
                            {
                                t('section.deleteDescription', {
                                    name: daySections.find((s) => s.id === sectionId)?.name,
                                    count: placeCount,
                                    target: defaultSectionName,
                                })
                            }
                        </p>
                        <div className="section-actions">
                            <Button
                                variant="secondary"
                                disabled={ mutating }
                                onClick={ async () => {
                                    try {
                                        await onDelete();
                                        setSectionAction(null);
                                    } catch {
                                        /* Page displays mutation errors. */
                                    }
                                } }
                            >
                                {
                                    mutating ? t('common.status.working') : t('section.button.delete')
                                }
                            </Button>
                            <button
                                type="button"
                                className="text-button"
                                disabled={ mutating }
                                onClick={ () => setSectionAction(null) }
                            >
                                {
                                    t('common.button.cancel')
                                }
                            </button>
                        </div>
                    </div>
                )
            }
            <p className="small muted">
                {
                    t('section.description')
                }
            </p>
        </section>
    );
}
