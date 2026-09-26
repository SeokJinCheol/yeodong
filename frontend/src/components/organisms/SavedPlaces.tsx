import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { filterSavedPlaces } from '../../lib/planner';
import { VisitStatusControl } from '../molecules/VisitStatusControl';
import { PlaceMapLink } from '../molecules/PlaceMapLink';
import { Fragment, useState } from 'react';
import { StepDirections } from '../molecules/StepDirections';
import { Pencil, Trash2 } from 'lucide-react';
import type { Mode, Place, VisitStatus } from '../../lib/types';
import { minutes } from '../../lib/api';
import { PlaceChecklist } from '../molecules/PlaceChecklist';
export function SavedPlaces({
    places,
    selectedId,
    busy,
    onSelect,
    onEdit,
    onDateChange,
    onDelete,
    onUpdated,
    onVisitStatus,
    expanded = false,
    numbered = false,
    directionsMode,
    title = t('place.saved.title'),
}: {
    directionsMode?: Mode;
    expanded?: boolean;
    numbered?: boolean;
    title?: string;
    places: Place[];
    selectedId?: number;
    busy: boolean;
    onSelect: (p: Place) => void;
    onEdit: (p: Place) => void;
    onDateChange: (p: Place, date: string) => void;
    onDelete: (p: Place) => void;
    onUpdated: (p: Place) => void;
    onVisitStatus: (p: Place, status: VisitStatus) => void;
}) {
    useTranslation();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const visiblePlaces = numbered ? places : filterSavedPlaces(places, query, filter);
    return (
        <details
            className="saved-places"
            open={ expanded || undefined }
        >
            <summary>
                {
                    title
                }
                { " " }
                <span>
                    {
                        places.length
                    }
                </span>
            </summary>
            {
                !numbered && (
                    <div className="saved-place-filters">
                        <input
                            type="search"
                            aria-label={ t('place.saved.searchLabel') }
                            placeholder={ t('place.saved.searchPlaceholder') }
                            value={ query }
                            onChange={ (e) => setQuery(e.target.value) }
                        />
                        <select
                            aria-label={ t('place.saved.filterLabel') }
                            value={ filter }
                            onChange={ (e) => setFilter(e.target.value) }
                        >
                            <option value="all">
                                {
                                    t('place.saved.all')
                                }
                            </option>
                            <option value="unscheduled">
                                {
                                    t('place.saved.unscheduled')
                                }
                            </option>
                            <option value="scheduled">
                                {
                                    t('place.saved.scheduled')
                                }
                            </option>
                            <option value="pending">
                                {
                                    t('place.visitStatus.pending')
                                }
                            </option>
                            <option value="visited">
                                {
                                    t('place.visitStatus.visited')
                                }
                            </option>
                            <option value="skipped">
                                {
                                    t('place.visitStatus.skipped')
                                }
                            </option>
                        </select>
                        <span>
                            {
                                t('place.count', { count: visiblePlaces.length })
                            }
                        </span>
                    </div>
                )
            }
            <div className="saved-place-list">
                {
                    visiblePlaces.length === 0 && <p className="muted">
                        {
                            t('place.saved.empty')
                        }
                    </p>
                }
                {
                    visiblePlaces.map((p, i) => (
                        <Fragment key={ `${p.id}-${i}` }>
                            <article className="saved-place-card">
                                <div className="saved-place-heading">
                                    <div className="saved-place-title">
                                        {
                                            numbered && (
                                                <span className="order-badge">
                                                    {
                                                        i === 0
                                                            ? t('route.label.start')
                                                            : i === places.length - 1
                                                                ? t('route.label.arrival')
                                                                : `STEP ${String(i).padStart(2, '0')}`
                                                    }
                                                </span>
                                            )
                                        }
                                        <button
                                            type="button"
                                            className="saved-place-name"
                                            aria-pressed={ selectedId === p.id }
                                            onClick={ () => onSelect(p) }
                                        >
                                            {
                                                p.name
                                            }
                                        </button>
                                    </div>
                                    <div className="saved-place-actions">
                                        <button
                                            type="button"
                                            disabled={ busy }
                                            onClick={ () => onEdit(p) }
                                            aria-label={ t('common.accessibility.edit', {
                                                name: p.name,
                                            }) }
                                            title={ t('common.button.edit') }
                                        >
                                            <Pencil size={ 15 } />
                                        </button>
                                        <PlaceMapLink place={ p } />
                                        <button
                                            type="button"
                                            className="delete"
                                            disabled={ busy }
                                            onClick={ () => onDelete(p) }
                                            aria-label={ t('common.accessibility.delete', {
                                                name: p.name,
                                            }) }
                                            title={ t('common.button.delete') }
                                        >
                                            <Trash2 size={ 15 } />
                                        </button>
                                    </div>
                                </div>
                                <VisitStatusControl
                                    place={ p }
                                    busy={ busy }
                                    onChange={ onVisitStatus }
                                />
                                <div className="saved-place-meta">
                                    <span>
                                        {
                                            t('place.stayDuration', { duration: minutes(p.stay_minutes) })
                                        }
                                    </span>
                                    {
                                        p.required_time && (
                                            <span>
                                                {
                                                    t('schedule.requiredTime', { time: p.required_time })
                                                }
                                            </span>
                                        )
                                    }
                                    {
                                        p.required_order && (
                                            <span>
                                                {
                                                    t('place.fixedStep', {
                                                        step: String(p.required_order).padStart(2, '0'),
                                                    })
                                                }
                                            </span>
                                        )
                                    }
                                </div>
                                <label className="saved-place-date">
                                    <span>
                                        {
                                            t('place.form.visitDate')
                                        }
                                    </span>
                                    <input
                                        aria-label={ t('place.visitDateLabel', { name: p.name }) }
                                        type="date"
                                        value={ p.visit_date ?? '' }
                                        disabled={ busy }
                                        onChange={ (e) => onDateChange(p, e.target.value) }
                                    />
                                </label>
                                <PlaceChecklist
                                    place={ p }
                                    onUpdated={ onUpdated }
                                />
                            </article>
                            {
                                directionsMode && places[i + 1] && (
                                    <StepDirections
                                        from={ p }
                                        to={ places[i + 1] }
                                        mode={ directionsMode }
                                    />
                                )
                            }
                        </Fragment>
                    ))
                }
            </div>
        </details>
    );
}
