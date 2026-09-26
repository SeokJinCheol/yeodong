import { useState } from 'react';
import type { Place, VisitStatus } from '../../lib/types';

export function VisitStatusControl({
    place,
    busy,
    onChange,
}: {
    place: Place;
    busy: boolean;
    onChange: (place: Place, status: VisitStatus) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const status = place.visit_status ?? 'pending';
    return (
        <div
            className="visit-status"
            data-status={ status }
        >
            <select
                aria-label={ `${place.name} 방문 상태` }
                value={ status }
                disabled={ busy }
                onChange={ (e) => {
                    setExpanded(false);
                    onChange(place, e.target.value as VisitStatus);
                } }
            >
                <option value="pending">
                    방문 예정
                </option>
                <option value="visited">
                    방문 완료
                </option>
                <option value="skipped">
                    건너뛰기
                </option>
            </select>
            {
                status !== 'pending' && (
                    <button
                        type="button"
                        className="visit-toggle"
                        aria-expanded={ expanded }
                        onClick={ () => setExpanded(!expanded) }
                    >
                        {
                            expanded ? '상세 접기' : '상세 보기'
                        }
                    </button>
                )
            }
        </div>
    );
}
