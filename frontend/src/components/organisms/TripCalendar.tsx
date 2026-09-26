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
            aria-label="여행 일정 달력"
        >
            <div className="calendar-topline">
                <span>
                    여행 일정 달력
                </span>
                <button
                    type="button"
                    className="calendar-collapse"
                    onClick={ onClose }
                    aria-label="달력 접기"
                >
                    접기 ⌃
                </button>
            </div>
            <header>
                <button
                    aria-label="이전 달"
                    onClick={ () => move(-1) }
                >
                    ‹
                </button>
                <strong>
                    {
                        year
                    }
                    { '년 ' }
                    {
                        m
                    }
                    월
                </strong>
                <button
                    aria-label="다음 달"
                    onClick={ () => move(1) }
                >
                    ›
                </button>
            </header>
            <div className="calendar-grid">
                {
                    ['일', '월', '화', '수', '목', '금', '토'].map((d) => (
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
                                aria-label={ `${value}, ${count[value] ?? 0}개 장소 방문 예정` }
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
                                    count[value] > 0 && <small>
                                        {
                                            count[value]
                                        }
                                        개 장소 방문 예정
                                    </small>
                                }
                            </button>
                        );
                    })
                }
            </div>
            <p>
                점이 있는 날짜에는 저장된 일정이 있습니다. 날짜를 누르면 해당 일정이 열립니다.
            </p>
        </section>
    );
}
