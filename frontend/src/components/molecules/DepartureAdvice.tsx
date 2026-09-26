import type { Plan, ScheduleStop } from '../../lib/types';
export function DepartureAdvice({ stop, plan }: { stop: ScheduleStop; plan: Plan }) {
    if (!stop.leave_by) return null;
    const deadline = new Date(stop.leave_by);
    const late = new Date(stop.departure_time).getTime() > deadline.getTime();
    const label = deadline.toLocaleString('ko-KR', {
        timeZone: plan.time_zone,
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    return (
        <div className={ `departure-advice ${late ? 'late' : ''}` }>
            <strong>
                {
                    label
                }
                까지 이곳에서 출발
                {
                    plan.mode === 'TRANSIT' ? ' (참고 시각)' : ''
                }
            </strong>
            <span>
                {
                    stop.leave_by_destination
                }
                { '에 ' }
                {
                    stop.leave_by_required_time
                }
                { ' 도착 기준' }
            </span>
            <small>
                {
                    plan.mode === 'TRANSIT'
                        ? '현재 조회한 구간 시간으로 역산한 값입니다. 이 시각의 운행을 보장하지 않으므로 출발 시각을 변경해 다시 조회하세요.'
                        : '현재 구간 소요시간으로 계산한 출발 마감 시각입니다. 여유 있게 출발하세요.'
                }
            </small>
            {
                late && (
                    <strong>
                        현재 일정은 출발 마감보다 늦습니다. 이전 일정이나 머무르기 시간을 줄여 주세요.
                    </strong>
                )
            }
        </div>
    );
}
