import { t, translateMessage } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button } from '../atoms/Button';

export function CopyItineraryForm({
    count,
    busy,
    onCopy,
}: {
    count: number;
    busy: boolean;
    onCopy: (target: string) => Promise<void>;
}) {
    useTranslation();
    const [target, setTarget] = useState('');
    const [error, setError] = useState('');
    return (
        <details className="move-day copy-itinerary">
            <summary>
                {
                    t('itinerary.copy.title')
                }
            </summary>
            <form
                onSubmit={ async (e) => {
                    e.preventDefault();
                    setError('');
                    try {
                        await onCopy(target);
                    } catch (e) {
                        setError((e as Error).message);
                    }
                } }
            >
                <p>
                    {
                        t('itinerary.copy.description')
                    }
                </p>
                <label>
                    {
                        t('itinerary.copy.dateLabel')
                    }
                    <input
                        aria-label={ t('itinerary.copy.dateAriaLabel') }
                        type="date"
                        required
                        value={ target }
                        disabled={ busy }
                        onChange={ (e) => setTarget(e.target.value) }
                    />
                </label>
                {
                    error && (
                        <p
                            role="alert"
                            className="error"
                        >
                            {
                                translateMessage(error)
                            }
                        </p>
                    )
                }
                <Button
                    variant="secondary"
                    disabled={ busy || !count || !target }
                >
                    {
                        busy ? t('common.status.copying') : t('itinerary.copy.button')
                    }
                </Button>
            </form>
        </details>
    );
}
