import { t, locale, translateMessage } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { activeTripId, switchTrip } from '../../lib/api';
import { useTripTools } from '../../hooks/useTripTools';
import type { TrashItem } from '../../lib/types';
import { Button } from '../atoms/Button';

export function TripTools({
    busy,
    trash,
    onRestore,
    runMutation,
}: {
    busy: boolean;
    trash: TrashItem[];
    onRestore: (id: number) => Promise<void>;
    runMutation: (action: () => Promise<unknown>) => Promise<void>;
}) {
    useTranslation();
    const tools = useTripTools(runMutation);
    const [name, setName] = useState('');
    const [restoreError, setRestoreError] = useState('');
    const disabled = busy || tools.busy;
    return (
        <section
            className="trip-tools"
            aria-label={ t('trip.manageLabel') }
        >
            <label>
                {
                    t('trip.label')
                }
                <select
                    aria-label={ t('trip.current') }
                    value={ activeTripId }
                    disabled={ disabled }
                    onChange={ (e) => switchTrip(Number(e.target.value)) }
                >
                    {
                        tools.trips.map((trip) => (
                            <option
                                key={ trip.id }
                                value={ trip.id }
                            >
                                {
                                    trip.name
                                }
                            </option>
                        ))
                    }
                </select>
            </label>
            <details>
                <summary>
                    {
                        t('trip.tools.title')
                    }
                </summary>
                <div className="trip-tools-panel">
                    <form
                        onSubmit={ (e) => {
                            e.preventDefault();
                            void tools.saveTrip(name, true);
                        } }
                    >
                        <label>
                            {
                                t('trip.name')
                            }
                            <input
                                aria-label={ t('trip.name') }
                                value={ name }
                                maxLength={ 80 }
                                onChange={ (e) => setName(e.target.value) }
                                placeholder={ t('trip.namePlaceholder') }
                            />
                        </label>
                        <div className="tool-actions">
                            <Button disabled={ disabled || !name.trim() }>
                                {
                                    t('trip.button.create')
                                }
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={ disabled || !name.trim() }
                                onClick={ () => void tools.saveTrip(name, false) }
                            >
                                {
                                    t('trip.button.rename')
                                }
                            </Button>
                        </div>
                    </form>
                    <div className="tool-actions">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={ disabled }
                            onClick={ () => void tools.download() }
                        >
                            {
                                t('backup.button.download')
                            }
                        </Button>
                        <label className="backup-upload">
                            {
                                t('backup.button.import')
                            }
                            <input
                                aria-label={ t('backup.fileLabel') }
                                type="file"
                                accept=".json,application/json"
                                disabled={ disabled }
                                onChange={ async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    await tools.importFile(file);
                                    e.target.value = '';
                                } }
                            />
                        </label>
                    </div>
                    <p className="small muted">
                        {
                            t('backup.description')
                        }
                    </p>
                    {
                        tools.error && (
                            <p
                                role="alert"
                                className="error"
                            >
                                {
                                    translateMessage(tools.error)
                                }
                            </p>
                        )
                    }
                    {
                        tools.success && <p role="status">
                            {
                                translateMessage(tools.success)
                            }
                        </p>
                    }
                    <details className="trash-list">
                        <summary>
                            {
                                t('trash.count', { count: trash.length })
                            }
                        </summary>
                        {
                            trash.length === 0 && <p>
                                {
                                    t('trash.empty')
                                }
                            </p>
                        }
                        {
                            trash.map((item) => (
                                <div
                                    className="trash-item"
                                    key={ item.id }
                                >
                                    <span>
                                        {
                                            item.label
                                        }
                                        <small>
                                            {
                                                new Date(item.deleted_at).toLocaleString(locale())
                                            }
                                        </small>
                                    </span>
                                    <Button
                                        variant="secondary"
                                        disabled={ disabled }
                                        onClick={ async () => {
                                            setRestoreError('');
                                            try {
                                                await onRestore(item.id);
                                            } catch (e) {
                                                setRestoreError((e as Error).message);
                                            }
                                        } }
                                    >
                                        {
                                            t('common.button.restore')
                                        }
                                    </Button>
                                </div>
                            ))
                        }
                        {
                            restoreError && (
                                <p
                                    role="alert"
                                    className="error"
                                >
                                    {
                                        translateMessage(restoreError)
                                    }
                                </p>
                            )
                        }
                    </details>
                </div>
            </details>
        </section>
    );
}
