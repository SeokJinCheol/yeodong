import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { Place } from '../../lib/types';
import { PlaceMapLink } from '../molecules/PlaceMapLink';
import { Button } from '../atoms/Button';

export function ItineraryProgress({
    places,
    orderPlaces,
    start,
    end,
    busy,
    orderMode,
    onOrder,
    onRemaining,
    onAll,
    remainingOnly,
    canCalculate,
}: {
    places: Place[];
    orderPlaces: Place[];
    start?: number;
    end?: number;
    busy: boolean;
    orderMode: string;
    onOrder: (ids: number[], automatic: boolean) => Promise<void>;
    onRemaining: () => void;
    onAll: () => void;
    remainingOnly: boolean;
    canCalculate: boolean;
}) {
    useTranslation();
    const [dragged, setDragged] = useState<number>();
    const unique = [...new Map(places.map((p) => [p.id, p])).values()];
    const next = unique.find((p) => p.id !== start && (p.visit_status ?? 'pending') === 'pending');
    const completed = unique.filter((p) => p.visit_status === 'visited').length;
    const middle = orderPlaces.filter((p) => p.id !== start && p.id !== end);
    function move(from: number, to: number) {
        if (busy || from === to || to < 0 || to >= middle.length) return;
        const ids = middle.map((p) => p.id);
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        void onOrder(ids, false);
    }
    return (
        <section
            className="itinerary-progress"
            aria-label={ t('itinerary.progress.label') }
        >
            <div className="progress-top">
                <span>
                    {
                        t('itinerary.progress.completed', { completed, total: unique.length })
                    }
                </span>
                {
                    next ? (
                        <span>
                            <strong>
                                {
                                    t('itinerary.progress.next', { name: next.name })
                                }
                            </strong>
                            <PlaceMapLink place={ next } />
                        </span>
                    ) : (
                        <span>
                            {
                                t('itinerary.progress.finished')
                            }
                        </span>
                    )
                }
            </div>
            <div className="tool-actions">
                <Button
                    variant="secondary"
                    disabled={ busy || !canCalculate }
                    onClick={ onRemaining }
                >
                    {
                        t('route.button.recalculateRemaining')
                    }
                </Button>
                {
                    remainingOnly && (
                        <Button
                            variant="secondary"
                            disabled={ busy }
                            onClick={ onAll }
                        >
                            {
                                t('route.button.showAll')
                            }
                        </Button>
                    )
                }
            </div>
            <details className="step-order-editor">
                <summary>
                    {
                        t('itinerary.order.summary', {
                            mode:
                                orderMode === 'manual'
                                    ? t('itinerary.order.manual')
                                    : t('itinerary.order.automatic'),
                        })
                    }
                </summary>
                <p className="small muted">
                    {
                        t('itinerary.order.description')
                    }
                </p>
                <ol>
                    {
                        middle.map((place, index) => (
                            <li
                                key={ place.id }
                                draggable={ !busy }
                                onDragStart={ (e) => {
                                    setDragged(index);
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', String(place.id));
                                } }
                                onDragOver={ (e) => e.preventDefault() }
                                onDragEnd={ () => setDragged(undefined) }
                                onDrop={ (e) => {
                                    e.preventDefault();
                                    if (dragged !== undefined) move(dragged, index);
                                    setDragged(undefined);
                                } }
                            >
                                <span>
                                    { '⠿ ' }
                                    {
                                        index + 1
                                    }
                                    { '. ' }
                                    {
                                        place.name
                                    }
                                </span>
                                <button
                                    aria-label={ t('common.accessibility.moveUp', { name: place.name }) }
                                    disabled={ busy || index === 0 }
                                    onClick={ () => move(index, index - 1) }
                                >
                                    ↑
                                </button>
                                <button
                                    aria-label={ t('common.accessibility.moveDown', {
                                        name: place.name,
                                    }) }
                                    disabled={ busy || index === middle.length - 1 }
                                    onClick={ () => move(index, index + 1) }
                                >
                                    ↓
                                </button>
                            </li>
                        ))
                    }
                </ol>
                <Button
                    variant="secondary"
                    disabled={ busy || !middle.length }
                    onClick={ () =>
                        void onOrder(
                            middle.map((p) => p.id),
                            true,
                        )
                    }
                >
                    {
                        t('itinerary.order.reset')
                    }
                </Button>
            </details>
        </section>
    );
}
