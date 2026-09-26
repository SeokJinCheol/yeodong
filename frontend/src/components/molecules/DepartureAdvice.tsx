import { t, locale } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import type { Plan, ScheduleStop } from '../../lib/types';
export function DepartureAdvice({ stop, plan }: { stop: ScheduleStop; plan: Plan }) {
    useTranslation();
    if (!stop.leave_by) return null;
    const deadline = new Date(stop.leave_by);
    const late = new Date(stop.departure_time).getTime() > deadline.getTime();
    const label = deadline.toLocaleString(locale(), {
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
                    t(plan.mode === 'TRANSIT' ? 'departure.estimatedDeadline' : 'departure.deadline', {
                        time: label,
                    })
                }
            </strong>
            <span>
                {
                    t('departure.arrival', {
                        destination: stop.leave_by_destination,
                        time: stop.leave_by_required_time,
                    })
                }
            </span>
            <small>
                {
                    plan.mode === 'TRANSIT'
                        ? t('departure.transitNotice')
                        : t('departure.routeNotice')
                }
            </small>
            {
                late && <strong>
                    {
                        t('departure.lateNotice')
                    }
                </strong>
            }
        </div>
    );
}
