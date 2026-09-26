import { t, locale } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { Place } from '../../lib/types';
import { localDate } from '../../lib/api';
export function TripCalendar({
    date,
    places,
    onSelect,
    onClose,
}: {
    date: string;
    places: Place[];
    onClose: () => void;
    onSelect: (date: string) => void;
}) {
    useTranslation();
    const [month, setMonth] = useState(() => (date || localDate()).slice(0, 7));
    const [year, m] = month.split('-').map(Number);
    const count: Record<string, number> = {};
    places.forEach((p) => {
        if (p.visit_date) count[p.visit_date] = (count[p.visit_date] ?? 0) + 1;
    });
    const offset = new Date(year, m - 1, 1).getDay(),
        days = new Date(year, m, 0).getDate();
    function move(delta: number) {
        const d = new Date(year, m - 1 + delta, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return (
        <section
            className="trip-calendar"
            aria-label={ t('calendar.title') }
        >
            <div className="calendar-topline">
                <span>
                    {
                        t('calendar.title')
                    }
                </span>
                <button
                    type="button"
                    className="calendar-collapse"
                    onClick={ onClose }
                    aria-label={ t('calendar.collapseLabel') }
                >
                    {
                        t('calendar.collapse')
                    }
                </button>
            </div>
            <header>
                <button
                    aria-label={ t('calendar.previousMonth') }
                    onClick={ () => move(-1) }
                >
                    ‹
                </button>
                <strong>
                    {
                        new Date(year, m - 1, 1).toLocaleDateString(locale(), {
                            year: 'numeric',
                            month: 'long',
                        })
                    }
                </strong>
                <button
                    aria-label={ t('calendar.nextMonth') }
                    onClick={ () => move(1) }
                >
                    ›
                </button>
            </header>
            <div className="calendar-grid">
                {
                    [
                        t('calendar.weekday.sunday'),
                        t('calendar.weekday.monday'),
                        t('calendar.weekday.tuesday'),
                        t('calendar.weekday.wednesday'),
                        t('calendar.weekday.thursday'),
                        t('calendar.weekday.friday'),
                        t('calendar.weekday.saturday'),
                    ].map((d) => (
                        <span
                            className="weekday"
                            key={ d }
                        >
                            {
                                d
                            }
                        </span>
                    ))
                }
                {
                    Array.from({ length: offset }, (_, i) => (
                        <span key={ `blank${i}` } />
                    ))
                }
                {
                    Array.from({ length: days }, (_, i) => {
                        const value = `${month}-${String(i + 1).padStart(2, '0')}`;
                        return (
                            <button
                                key={ value }
                                className={ `calendar-day ${date === value ? 'selected' : ''} ${value === localDate() ? 'today' : ''}` }
                                aria-pressed={ date === value }
                                aria-label={ t('calendar.dayLabel', {
                                    date: value,
                                    count: count[value] ?? 0,
                                }) }
                                onClick={ () => onSelect(value) }
                            >
                                <span>
                                    {
                                        i + 1
                                    }
                                    {
                                        count[value] > 0 && <i />
                                    }
                                </span>
                                {
                                    count[value] > 0 && (
                                        <small>
                                            {
                                                t('calendar.plannedStops', { count: count[value] })
                                            }
                                        </small>
                                    )
                                }
                            </button>
                        );
                    })
                }
            </div>
            <p>
                {
                    t('calendar.hint')
                }
            </p>
        </section>
    );
}
