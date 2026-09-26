import { ArrowDown, ExternalLink } from 'lucide-react';
import type { MapPlace, Mode } from '../../lib/types';
import { mapsLinks } from '../../lib/mapsUrl';

export function StepDirections({ from, to, mode }: { from: MapPlace; to: MapPlace; mode: Mode }) {
    const [{ url }] = mapsLinks([from, to], mode);
    return (
        <div className="step-directions">
            <ArrowDown size={ 14 } />
            <a
                href={ url }
                target="_blank"
                rel="noopener noreferrer"
                aria-label={ `${from.name}에서 ${to.name}까지 Google 길찾기` }
            >
                <span>
                    { '동선 열기 ' }
                    <ExternalLink size={ 13 } />
                </span>
                <small>
                    Google 길찾기 ·
                    { ' ' }
                    {
                        mode === 'WALK' ? '도보' : mode === 'DRIVE' ? '차량' : '대중교통'
                    }
                </small>
            </a>
        </div>
    );
}
