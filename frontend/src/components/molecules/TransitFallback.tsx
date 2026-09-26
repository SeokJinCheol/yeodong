import type { Place } from '../../lib/types';

export function TransitFallback({ places }: { places: Place[] }) {
    return (
        <section className="transit-fallback">
            <h3>
                Google 지도에서 교통편 확인
            </h3>
            <p>
                Valhalla 대중교통 동선 최적화는 지원하지 않습니다. 아래 구간은 필수 순서를 먼저
                반영한 목록이며 최적화된 코스가 아닙니다. 출발 날짜·시각은 Google 지도에서 다시
                설정하세요.
            </p>
            {
                places.slice(0, -1).map((place, i) => {
                    const next = places[i + 1];
                    const params = new URLSearchParams({
                        api: '1',
                        origin: `${place.lat},${place.lng}`,
                        destination: `${next.lat},${next.lng}`,
                        travelmode: 'transit',
                    });
                    if (place.google_place_id) params.set('origin_place_id', place.google_place_id);
                    if (next.google_place_id) params.set('destination_place_id', next.google_place_id);
                    return (
                        <a
                            key={ i }
                            target="_blank"
                            rel="noreferrer"
                            href={ `https://www.google.com/maps/dir/?${params}` }
                        >
                            {
                                place.name
                            }
                            { ' → ' }
                            {
                                next.name
                            }
                            <span>
                                대중교통 찾기 ↗
                            </span>
                        </a>
                    );
                })
            }
        </section>
    );
}
