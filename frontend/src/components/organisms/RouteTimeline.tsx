import { VisitStatusControl } from '../molecules/VisitStatusControl';
import { PlaceMapLink } from '../molecules/PlaceMapLink';
import {
    ArrowDown,
    Car,
    Clock3,
    Footprints,
    MapPin,
    Pencil,
    TrainFront,
    Trash2,
} from 'lucide-react';
import { minutes } from '../../lib/api';
import type { Place, Plan, VisitStatus } from '../../lib/types';
import { StepDirections } from '../molecules/StepDirections';
import { TransitLeg } from '../molecules/TransitLeg';
import { DepartureAdvice } from '../molecules/DepartureAdvice';
import { PlaceChecklist } from '../molecules/PlaceChecklist';
import { Button } from '../atoms/Button';

export function RouteTimeline({
    plan,
    onDelete,
    onEdit,
    busy,
    onSelect,
    selectedId,
    onUpdated,
    onVisitStatus,
}: {
    plan: Plan;
    onUpdated: (place: Place) => void;
    onVisitStatus: (place: Place, status: VisitStatus) => void;
    onSelect: (place: Place) => void;
    selectedId?: number;
    onDelete: (id: number) => void;
    busy: boolean;
    onEdit: (place: Place) => void;
}) {
    return (
        <div className="timeline">
            {
                plan.places.map((place, i) => (
                    <div
                        className="timeline-item"
                        key={ `${place.id}-${i}` }
                    >
                        <div
                            className={ `stop-number ${i === 0 || i === plan.places.length - 1 ? 'endpoint' : ''}` }
                        >
                            {
                                i === 0 || i === plan.places.length - 1 ? <MapPin size={ 15 } /> : i
                            }
                        </div>
                        <div className="stop-content">
                            <div className="stop-heading">
                                <div>
                                    <span className="stop-kind">
                                        {
                                            i === 0
                                                ? '출발'
                                                : i === plan.places.length - 1
                                                    ? '도착'
                                                    : `STEP ${String(i).padStart(2, '0')}`
                                        }
                                    </span>
                                    <h3>
                                        <button
                                            className="place-select"
                                            aria-pressed={ selectedId === place.id }
                                            onClick={ () => onSelect(place) }
                                        >
                                            {
                                                place.name
                                            }
                                        </button>
                                    </h3>
                                    {
                                        place.required_order && i > 0 && i < plan.places.length - 1 && (
                                            <span className="order-badge">
                                                { '필수 순서 ' }
                                                {
                                                    place.required_order
                                                }
                                            </span>
                                        )
                                    }
                                </div>
                                <Button
                                    variant="ghost"
                                    disabled={ busy }
                                    onClick={ () => onEdit(place) }
                                    aria-label={ `${place.name} 수정` }
                                >
                                    <Pencil size={ 14 } />
                                </Button>
                                <PlaceMapLink place={ place } />
                                <Button
                                    variant="ghost"
                                    disabled={ busy }
                                    onClick={ () => onDelete(place.id) }
                                    aria-label={ `${place.name} 삭제` }
                                >
                                    <Trash2 size={ 14 } />
                                </Button>
                            </div>
                            <VisitStatusControl
                                place={ place }
                                busy={ busy }
                                onChange={ onVisitStatus }
                            />
                            <p>
                                {
                                    place.area || place.address || '등록한 장소'
                                }
                                {
                                    i > 0 && i < plan.places.length - 1 && (
                                        <>
                                            <span className="dot">
                                                ·
                                            </span>
                                            <Clock3 size={ 12 } />
                                            {
                                                minutes(place.stay_minutes)
                                            }
                                            { ' 머무르기' }
                                        </>
                                    )
                                }
                            </p>
                            <PlaceChecklist
                                place={ place }
                                onUpdated={ onUpdated }
                            />
                            {
                                plan.schedule[i] && (
                                    <div
                                        className={ `stop-schedule ${plan.schedule[i].late_seconds ? 'late' : ''}` }
                                    >
                                        <span>
                                            도착
                                            { ' ' }
                                            {
                                                new Date(plan.schedule[i].arrival_time).toLocaleTimeString(
                                                    'ko-KR',
                                                    {
                                                        timeZone: plan.time_zone,
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false,
                                                    },
                                                )
                                            }
                                        </span>
                                        {
                                            plan.schedule[i].required_time && (
                                                <strong>
                                                    { '필수 ' }
                                                    {
                                                        plan.schedule[i].required_time
                                                    }
                                                </strong>
                                            )
                                        }
                                        {
                                            plan.schedule[i].wait_seconds > 0 && (
                                                <span>
                                                    { '대기 ' }
                                                    {
                                                        minutes(plan.schedule[i].wait_seconds / 60)
                                                    }
                                                </span>
                                            )
                                        }
                                        {
                                            plan.schedule[i].late_seconds > 0 && (
                                                <strong>
                                                    지각
                                                    { ' ' }
                                                    {
                                                        minutes(Math.ceil(plan.schedule[i].late_seconds / 60))
                                                    }
                                                </strong>
                                            )
                                        }
                                        <span>
                                            출발
                                            { ' ' }
                                            {
                                                new Date(plan.schedule[i].departure_time).toLocaleTimeString(
                                                    'ko-KR',
                                                    {
                                                        timeZone: plan.time_zone,
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false,
                                                    },
                                                )
                                            }
                                        </span>
                                    </div>
                                )
                            }
                            {
                                plan.schedule[i] && (
                                    <DepartureAdvice
                                        stop={ plan.schedule[i] }
                                        plan={ plan }
                                    />
                                )
                            }
                            {
                                plan.legs[i] && (
                                    <div className="travel-leg">
                                        <ArrowDown size={ 13 } />
                                        {
                                            plan.mode === 'WALK' ? (
                                                <Footprints size={ 14 } />
                                            ) : plan.mode === 'TRANSIT' ? (
                                                <TrainFront size={ 14 } />
                                            ) : (
                                                <Car size={ 14 } />
                                            )
                                        }
                                        <strong>
                                            {
                                                minutes(plan.legs[i].duration_seconds / 60)
                                            }
                                        </strong>
                                        <span>
                                            {
                                                plan.mode === 'WALK'
                                                    ? '도보'
                                                    : plan.mode === 'TRANSIT'
                                                        ? '대중교통'
                                                        : '차량'
                                            }
                                            { ' ' }
                                            { '· ' }
                                            {
                                                (plan.legs[i].distance_meters / 1000).toFixed(1)
                                            }
                                            { ' km' }
                                        </span>
                                    </div>
                                )
                            }
                            {
                                plan.mode === 'TRANSIT' && plan.legs[i] && (
                                    <TransitLeg
                                        leg={ plan.legs[i] }
                                        timeZone={ plan.time_zone }
                                    />
                                )
                            }
                            {
                                plan.places[i + 1] && (
                                    <StepDirections
                                        from={ place }
                                        to={ plan.places[i + 1] }
                                        mode={ plan.mode }
                                    />
                                )
                            }
                        </div>
                    </div>
                ))
            }
        </div>
    );
}
