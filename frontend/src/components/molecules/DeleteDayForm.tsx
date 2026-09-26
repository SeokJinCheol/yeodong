import { t, translateMessage } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button } from '../atoms/Button';

export function DeleteDayForm({
    date,
    count,
    sectionCount,
    busy,
    onDelete,
}: {
    date: string;
    count: number;
    sectionCount: number;
    busy: boolean;
    onDelete: () => Promise<void>;
}) {
    useTranslation();
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');
    return (
        <div className="delete-day">
            <button
                type="button"
                className="text-button section-delete"
                disabled={ busy }
                onClick={ () => {
                    setError('');
                    setConfirming(!confirming);
                } }
            >
                {
                    t('itinerary.deleteDay.button')
                }
            </button>
            {
                confirming && (
                    <div className="section-delete-confirm">
                        <p>
                            {
                                t('itinerary.deleteDay.description', {
                                    date,
                                    count,
                                    sections: sectionCount,
                                })
                            }
                        </p>
                        <div className="section-actions">
                            <Button
                                variant="secondary"
                                disabled={ busy }
                                onClick={ async () => {
                                    setError('');
                                    try {
                                        await onDelete();
                                        setConfirming(false);
                                    } catch (e) {
                                        setError((e as Error).message);
                                    }
                                } }
                            >
                                {
                                    busy ? t('common.status.deleting') : t('common.button.moveToTrash')
                                }
                            </Button>
                            <button
                                type="button"
                                className="text-button"
                                disabled={ busy }
                                onClick={ () => setConfirming(false) }
                            >
                                {
                                    t('common.button.cancel')
                                }
                            </button>
                        </div>
                        {
                            error && (
                                <p
                                    className="error"
                                    role="alert"
                                >
                                    {
                                        translateMessage(error)
                                    }
                                </p>
                            )
                        }
                    </div>
                )
            }
        </div>
    );
}
