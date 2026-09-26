import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button } from '../atoms/Button';
export function MoveDayForm({
    date,
    count,
    busy,
    onMove,
}: {
    date: string;
    count: number;
    busy: boolean;
    onMove: (target: string) => Promise<void>;
}) {
    useTranslation();
    const [target, setTarget] = useState('');
    return (
        <details className="move-day">
            <summary>
                {
                    t('itinerary.move.title')
                }
            </summary>
            <form
                onSubmit={ async (e) => {
                    e.preventDefault();
                    await onMove(target);
                } }
            >
                <p>
                    {
                        t('itinerary.move.description', { date, count })
                    }
                </p>
                <label>
                    {
                        t('itinerary.move.dateLabel')
                    }
                    <input
                        aria-label={ t('itinerary.move.dateAriaLabel') }
                        type="date"
                        required
                        value={ target }
                        onChange={ (e) => setTarget(e.target.value) }
                    />
                </label>
                <Button
                    variant="secondary"
                    disabled={ busy || !count || !target || target === date }
                >
                    {
                        t('itinerary.move.button')
                    }
                </Button>
            </form>
        </details>
    );
}
