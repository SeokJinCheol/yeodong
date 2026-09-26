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
            aria-label="여행 진행 상황"
        >
            <div className="progress-top">
                <span>
                    { '방문 완료 ' }
                    {
                        completed
                    }
                    { ' / ' }
                    {
                        unique.length
                    }
                </span>
                {
                    next ? (
                        <span>
                            { '다음: ' }
                            <strong>
                                {
                                    next.name
                                }
                            </strong>
                            { " " }
                            <PlaceMapLink place={ next } />
                        </span>
                    ) : (
                        <span>
                            남은 방문지가 없습니다.
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
                    남은 장소로 재계산
                </Button>
                {
                    remainingOnly && (
                        <Button
                            variant="secondary"
                            disabled={ busy }
                            onClick={ onAll }
                        >
                            전체 동선 보기
                        </Button>
                    )
                }
            </div>
            <details className="step-order-editor">
                <summary>
                    STEP 순서 편집 ·
                    { ' ' }
                    {
                        orderMode === 'manual' ? '수동 순서 유지' : '자동 최적화 / 필수 순서 반영'
                    }
                </summary>
                <p className="small muted">
                    위·아래 버튼 또는 드래그로 중간 방문 순서를 고정합니다. 출발·도착지는 일정
                    설정에서 변경하세요.
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
                                    aria-label={ `${place.name} 위로` }
                                    disabled={ busy || index === 0 }
                                    onClick={ () => move(index, index - 1) }
                                >
                                    ↑
                                </button>
                                <button
                                    aria-label={ `${place.name} 아래로` }
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
                    고정 순서 해제 · 자동 최적화
                </Button>
            </details>
        </section>
    );
}
