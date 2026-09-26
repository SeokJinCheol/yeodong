import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function DailyItinerarySettings({
    dateLabel,
    children,
}: {
    dateLabel: string;
    children: ReactNode;
}) {
    const [expanded, setExpanded] = useState(false);
    return (
        <section className={ `daily-settings ${expanded ? 'expanded' : ''}` }>
            <div className="itinerary-title">
                <div>
                    <span className="eyebrow">
                        DAILY ITINERARY
                    </span>
                    <h2>
                        {
                            dateLabel
                        }
                    </h2>
                </div>
                <button
                    type="button"
                    className="daily-settings-toggle"
                    aria-expanded={ expanded }
                    aria-controls="daily-settings-content"
                    onClick={ () => setExpanded(!expanded) }
                >
                    {
                        expanded ? '설정 접기' : '일정 설정'
                    }
                    <ChevronDown size={ 16 } />
                </button>
            </div>
            <div
                id="daily-settings-content"
                className="daily-settings-content"
            >
                {
                    children
                }
            </div>
        </section>
    );
}
