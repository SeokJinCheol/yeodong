import { Clock3, MapPin, Route, Sparkles } from 'lucide-react';
import { minutes } from '../../lib/api';
import type { MapPlace, Place, Plan } from '../../lib/types';
import { StatCard } from '../molecules/StatCard';
import { RouteMap } from './RouteMap';
interface Props {
    plan: Plan | null;
    selectedPlace?: Place;
    fallbackPlaces: Place[];
    busy: boolean;
    onAddPlace: (position: MapPlace) => void;
}
export function RouteOverview({ plan, selectedPlace, fallbackPlaces, busy, onAddPlace }: Props) {
    return (
        <div className="map-column">
            <div className="stats">
                <StatCard
                    icon={ <Route size={ 15 } /> }
                    label="총 이동시간"
                    value={ plan ? minutes(plan.total_travel_seconds / 60) : '—' }
                />
                <StatCard
                    icon={ <MapPin size={ 15 } /> }
                    label="총 이동거리"
                    value={ plan ? `${(plan.total_distance_meters / 1000).toFixed(1)} km` : '—' }
                />
                <StatCard
                    icon={ <Clock3 size={ 15 } /> }
                    label="이동 + 대기 + 머무르기"
                    value={ plan ? minutes(plan.total_elapsed_seconds / 60) : '—' }
                />
            </div>
            <RouteMap
                onAddPlace={ onAddPlace }
                plan={ plan }
                selectedPlace={ selectedPlace }
                fallbackPlaces={ !busy ? fallbackPlaces : [] }
            />
            {
                plan && (
                    <p className="schedule-summary">
                        { '대기 ' }
                        {
                            minutes(plan.total_wait_seconds / 60)
                        }
                        { ' · 마지막 도착' }
                        { ' ' }
                        {
                            new Date(plan.schedule.at(-1)!.visit_start).toLocaleString('ko-KR', {
                                timeZone: plan.time_zone,
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                            })
                        }
                    </p>
                )
            }
            <div className="tip">
                <Sparkles size={ 17 } />
                <p>
                    <strong>
                        한 걸음 더 여유로운 여행
                    </strong>
                    <br />
                    {
                        plan?.source === 'valhalla'
                            ? '장소를 추가하면 출발지와 도착지를 유지하며 동선을 다시 계산해요.'
                            : '도보·차량 동선을 계산한 뒤 Google 지도에서 열 수 있어요.'
                    }
                </p>
            </div>
        </div>
    );
}
