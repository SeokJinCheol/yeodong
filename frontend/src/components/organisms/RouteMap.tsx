import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Plan, Place, MapPlace } from '../../lib/types';

export function RouteMap({
    plan,
    selectedPlace,
    fallbackPlaces = [],
    onAddPlace,
}: {
    plan: Plan | null;
    selectedPlace?: Place;
    fallbackPlaces?: Place[];
    onAddPlace?: (position: MapPlace) => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const tilesRef = useRef<L.TileLayer | null>(null);
    const boundsRef = useRef<L.LatLngBounds | null>(null);
    const markersRef = useRef<{ marker: L.Marker; ids: number[]; label: string }[]>([]);
    const addRef = useRef(onAddPlace);
    addRef.current = onAddPlace;
    const [tileError, setTileError] = useState(false);
    const [loading, setLoading] = useState(true);
    const places = plan?.places ?? fallbackPlaces;
    const visible =
        selectedPlace && !places.some((p) => p.id === selectedPlace.id)
            ? [...places, selectedPlace]
            : places;
    const geometry = JSON.stringify({
        places: visible.map(({ id, lat, lng, name, address }) => ({ id, lat, lng, name, address })),
        route: plan?.coordinates ?? [],
        planned: !!plan,
    });

    function fitMap() {
        const map = mapRef.current;
        if (!map) return;
        map.invalidateSize();
        if (boundsRef.current?.isValid())
            map.fitBounds(boundsRef.current, { padding: [45, 45], maxZoom: 16 });
        else map.setView([35.6812, 139.7671], 13);
    }

    useEffect(() => {
        if (!container.current) return;
        const map = L.map(container.current, { scrollWheelZoom: false }).setView(
            [35.6812, 139.7671],
            13,
        );
        mapRef.current = map;
        const tiles = L.tileLayer(
            import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                maxZoom: 19,
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
            },
        ).addTo(map);
        tilesRef.current = tiles;
        const failed = new Set<HTMLElement>();
        const updateError = () => setTileError(failed.size > 0);
        tiles.on('loading', () => setLoading(true));
        tiles.on('load', () => setLoading(false));
        tiles.on('tileerror', (event) => {
            failed.add((event as L.TileErrorEvent).tile);
            updateError();
        });
        tiles.on('tileload', (event) => {
            failed.delete((event as L.TileEvent).tile);
            updateError();
        });
        tiles.on('tileunload', (event) => {
            failed.delete((event as L.TileEvent).tile);
            updateError();
        });
        const choosePosition = (event: L.LeafletMouseEvent) => {
            if (!addRef.current) return;
            const position = { lat: event.latlng.lat, lng: event.latlng.lng };
            const content = document.createElement('div');
            content.className = 'map-place-popup';
            const title = document.createElement('strong');
            title.textContent = '선택한 위치';
            const coordinates = document.createElement('p');
            coordinates.textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = '이 위치에 장소 추가';
            button.onclick = () => {
                map.closePopup();
                addRef.current?.(position);
            };
            content.append(title, coordinates, button);
            L.popup().setLatLng(event.latlng).setContent(content).openOn(map);
        };
        map.on('click', choosePosition);
        map.on('contextmenu', choosePosition);
        // Grid/date/section changes can resize the panel without a window resize.
        const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(container.current);
        return () => {
            observer.disconnect();
            tiles.off();
            map.remove();
            mapRef.current = null;
            tilesRef.current = null;
            markersRef.current = [];
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const layer = L.featureGroup().addTo(map);
        const groups = new Map<string, { place: Place; ids: number[]; labels: string[] }>();
        visible.forEach((place, i) => {
            const key = `${place.lat},${place.lng}`;
            const group = groups.get(key) ?? { place, ids: [], labels: [] };
            group.ids.push(place.id);
            group.labels.push(
                i >= places.length
                    ? '선택'
                    : i === 0
                        ? '출발'
                        : i === places.length - 1
                            ? '도착'
                            : String(i),
            );
            groups.set(key, group);
        });
        markersRef.current = [];
        groups.forEach(({ place, ids, labels }) => {
            const label =
                labels.includes('출발') && labels.includes('도착') ? '출발·도착' : labels.join('/');
            const marker = L.marker([place.lat, place.lng], {
                icon: markerIcon(label, false),
                title: `${place.name} · ${label}`,
                alt: place.name,
            }).addTo(layer);
            const content = document.createElement('div');
            content.className = 'map-place-popup';
            const title = document.createElement('strong');
            title.textContent = place.name;
            const address = document.createElement('p');
            address.textContent = place.address;
            content.append(title, address);
            marker.bindPopup(content);
            markersRef.current.push({ marker, ids, label });
        });
        const path: L.LatLngTuple[] = plan
            ? plan.coordinates.map(([lng, lat]) => [lat, lng])
            : places.map((p) => [p.lat, p.lng]);
        if (path.length > 1)
            L.polyline(path, {
                color: plan ? '#27634d' : '#a47a50',
                weight: 4,
                opacity: 0.9,
                dashArray: plan ? undefined : '8 8',
            }).addTo(layer);
        boundsRef.current = layer.getBounds();
        fitMap();
        return () => {
            layer.remove();
        };
    }, [geometry]);

    useEffect(() => {
        markersRef.current.forEach(({ marker, ids, label }) => {
            const active = selectedPlace !== undefined && ids.includes(selectedPlace.id);
            marker.setIcon(markerIcon(label, active));
            marker.setZIndexOffset(active ? 1000 : 0);
        });
        if (selectedPlace) mapRef.current?.setView([selectedPlace.lat, selectedPlace.lng], 16);
    }, [selectedPlace?.id, selectedPlace?.lat, selectedPlace?.lng, geometry]);

    return (
        <section className="map-panel">
            <div className="map-heading">
                <span>
                    <MapIcon size={ 17 } />
                    오늘의 여행 지도
                </span>
                <span className="map-status">
                    OpenStreetMap
                </span>
                <button
                    type="button"
                    className="text-button"
                    onClick={ fitMap }
                >
                    전체 동선 보기
                </button>
            </div>
            {
                onAddPlace && (
                    <p className="map-position-note">
                        지도를 클릭하거나 길게 눌러 장소를 추가하세요.
                    </p>
                )
            }
            {
                selectedPlace && (
                    <div className="map-selection">
                        {
                            selectedPlace.name
                        }
                        { ' · 선택한 장소' }
                    </div>
                )
            }
            <div className="route-map-wrap">
                <div
                    ref={ container }
                    className="route-map"
                    aria-label="여행 지도"
                />
                {
                    loading && !tileError && (
                        <span
                            className="map-loading"
                            role="status"
                        >
                            지도 불러오는 중…
                        </span>
                    )
                }
            </div>
            {
                tileError && (
                    <div
                        className="map-tile-error"
                        role="alert"
                    >
                        배경 지도를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.
                        { ' ' }
                        <button
                            type="button"
                            onClick={ () => tilesRef.current?.redraw() }
                        >
                            다시 불러오기
                        </button>
                    </div>
                )
            }
            <div className="map-footer">
                <i />
                <span>
                    {
                        plan
                            ? 'Valhalla로 계산한 실제 이동 경로'
                            : '방문 순서 표시 · 점선은 실제 이동 경로가 아닙니다'
                    }
                </span>
            </div>
        </section>
    );
}

function markerIcon(label: string, active: boolean) {
    const content = document.createElement('span');
    content.className = `route-map-pin${active ? ' selected' : ''}`;
    content.textContent = label;
    return L.divIcon({
        html: content,
        className: 'route-map-marker',
        iconSize: [64, 36],
        iconAnchor: [32, 18],
        popupAnchor: [0, -20],
    });
}
