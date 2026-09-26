import { useState } from 'react';
import type { Place } from '../../lib/types';
import { api, json } from '../../lib/api';
export function PlaceChecklist({
    place,
    onUpdated,
}: {
    place: Place;
    onUpdated: (place: Place) => void;
}) {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const tasks = place.tasks ?? [];
    if (!place.description && !tasks.length) return null;
    return (
        <div className="place-checklist">
            {
                place.description && <div className="place-description">
                    {
                        place.description
                    }
                </div>
            }
            {
                tasks.length > 0 && (
                    <>
                        <strong>
                            { '할 일 · ' }
                            {
                                tasks.filter((t) => t.done).length
                            }
                            /
                            {
                                tasks.length
                            }
                            { ' 완료' }
                        </strong>
                        {
                            tasks.map((task) => (
                                <div key={ task.id }>
                                    <label className={ task.done ? 'task-done' : '' }>
                                        <input
                                            type="checkbox"
                                            disabled={ busy }
                                            checked={ task.done }
                                            onChange={ async (e) => {
                                                setBusy(true);
                                                setError('');
                                                try {
                                                    onUpdated(
                                                        await api<Place>(
                                                            `/places/${place.id}/tasks/${encodeURIComponent(task.id)}`,
                                                            json('PATCH', { done: e.target.checked }),
                                                        ),
                                                    );
                                                } catch (e) {
                                                    setError((e as Error).message);
                                                } finally {
                                                    setBusy(false);
                                                }
                                            } }
                                        />
                                        {
                                            task.text
                                        }
                                    </label>
                                </div>
                            ))
                        }
                    </>
                )
            }
            {
                error && (
                    <p
                        role="alert"
                        className="error"
                    >
                        {
                            error
                        }
                    </p>
                )
            }
        </div>
    );
}
