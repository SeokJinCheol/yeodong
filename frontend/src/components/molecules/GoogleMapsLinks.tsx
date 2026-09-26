import type { Plan } from '../../lib/types';
import { mapsLinks } from '../../lib/mapsUrl';

export function GoogleMapsLinks({ plan }: { plan: Plan }) {
    const links = mapsLinks(plan.places, plan.mode);
    return (
        <section
            className="transit-fallback"
            aria-label="완성된 동선 내보내기"
        >
            <h3>
                Google 지도에서 동선 열기
            </h3>
            <p>
                계산된 방문 순서를 전달합니다. 실제 경로와 소요시간은 Google 지도에서 다시
                계산됩니다.
            </p>
            {
                links.length > 1 && (
                    <p>
                        모바일에서도 경유지가 빠지지 않도록 동선을 나누었습니다. 번호 순서대로 열어
                        주세요.
                    </p>
                )
            }
            {
                links.map(({ url, start, end }, i) => (
                    <a
                        key={ i }
                        href={ url }
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {
                            links.length > 1 ? `${i + 1}. ` : ''
                        }
                        {
                            plan.places[start].name
                        }
                        { ' → ' }
                        {
                            plan.places[end].name
                        }
                        <span>
                            동선 열기 ↗
                        </span>
                    </a>
                ))
            }
        </section>
    );
}
