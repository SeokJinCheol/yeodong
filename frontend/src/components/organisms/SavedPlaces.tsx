import { PlaceMapLink } from '../molecules/PlaceMapLink';
import { Fragment } from 'react';
import { StepDirections } from '../molecules/StepDirections';
import { Pencil, Trash2 } from 'lucide-react';
import type { Mode, Place } from '../../lib/types';
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
    expanded = false,
    numbered = false,
    directionsMode,
    title = '저장한 장소 관리',
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
}) {
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
            <div className="saved-place-list">
                {
                    places.length === 0 && <p className="muted">
                        저장한 장소가 없습니다.
                    </p>
                }
                {
                    places.map((p, i) => (
                        <Fragment key={ `${p.id}-${i}` }>
                            <article className="saved-place-card">
                                <div className="saved-place-heading">
                                    <div className="saved-place-title">
                                        {
                                            numbered && (
                                                <span className="order-badge">
                                                    {
                                                        i === 0
                                                            ? '출발'
                                                            : i === places.length - 1
                                                                ? '도착'
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
                                            aria-label={ `${p.name} 수정` }
                                            title="수정"
                                        >
                                            <Pencil size={ 15 } />
                                        </button>
                                        <PlaceMapLink place={ p } />
                                        <button
                                            type="button"
                                            className="delete"
                                            disabled={ busy }
                                            onClick={ () => onDelete(p) }
                                            aria-label={ `${p.name} 삭제` }
                                            title="삭제"
                                        >
                                            <Trash2 size={ 15 } />
                                        </button>
                                    </div>
                                </div>
                                <div className="saved-place-meta">
                                    <span>
                                        {
                                            minutes(p.stay_minutes)
                                        }
                                        { ' 머무르기' }
                                    </span>
                                    {
                                        p.required_time && (
                                            <span>
                                                { '필수 ' }
                                                {
                                                    p.required_time
                                                }
                                            </span>
                                        )
                                    }
                                    {
                                        p.required_order && (
                                            <span>
                                                { 'STEP ' }
                                                {
                                                    String(p.required_order).padStart(2, '0')
                                                }
                                                { ' 고정' }
                                            </span>
                                        )
                                    }
                                </div>
                                <label className="saved-place-date">
                                    <span>
                                        방문 날짜
                                    </span>
                                    <input
                                        aria-label={ `${p.name} 방문 날짜` }
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
