import { useEffect, useRef, useState } from 'react';
import { CalendarDays, MapPin, Plus, RefreshCw, Route, Sparkles } from 'lucide-react';
import { api, json, localDate } from '../lib/api';
import type { MapPlace, Place } from '../lib/types';
import { Button } from '../components/atoms/Button';
import { DeleteDayForm } from '../components/molecules/DeleteDayForm';
import { CopyItineraryForm } from '../components/molecules/CopyItineraryForm';
import { MoveDayForm } from '../components/molecules/MoveDayForm';
import { Badge } from '../components/atoms/Badge';
import { ModeSwitch } from '../components/molecules/ModeSwitch';
import { PlaceForm } from '../components/organisms/PlaceForm';
import { RouteTimeline } from '../components/organisms/RouteTimeline';
import { RouteOverview } from '../components/organisms/RouteOverview';
import { CourseList } from '../components/organisms/CourseList';
import { SavedPlaces } from '../components/organisms/SavedPlaces';
import { TripCalendar } from '../components/organisms/TripCalendar';
import { PlannerLayout } from '../components/templates/PlannerLayout';

import { usePlannerData } from '../hooks/usePlannerData';
import { useRoutePlan } from '../hooks/useRoutePlan';
import { useRouteSettings } from '../hooks/useRouteSettings';
import { useRouteSections } from '../hooks/useRouteSections';
import { fallbackRoute, orderedPlacesFor, plannerDates } from '../lib/planner';
import { RouteSectionManager } from '../components/organisms/RouteSectionManager';
import { RouteSettings } from '../components/organisms/RouteSettings';

export function PlannerPage() {
    const data = usePlannerData();
    const {
        allPlaces,
        courses,
        sections,
        defaultSectionNames,
        loaded,
        live,
        error,
        setError,
        mutating,
        load,
        mutate,
        updateChecklist,
    } = data;
    const [date, setDate] = useState(''),
        [calendarOpen, setCalendarOpen] = useState(false);
    const initialized = useRef(false);
    useEffect(() => {
        if (!loaded || initialized.current) return;
        initialized.current = true;
        const availableDates = plannerDates(allPlaces, sections, defaultSectionNames);
        const initial = availableDates.find((d) => d >= localDate()) ?? availableDates.at(-1) ?? '';
        setDate(initial);
        setCalendarOpen(!initial);
    }, [loaded, allPlaces, sections, defaultSectionNames]);
    const section = useRouteSections(date, sections, defaultSectionNames, data.runMutation);
    const { sectionId, daySections, defaultSectionName, setSectionId } = section;
    const places = allPlaces.filter((p) => (p.section_id ?? null) === sectionId);
    const settings = useRouteSettings(places, date, sectionId);
    const { start, end, departureTime, timeZone } = settings;
    const route = useRoutePlan({
        places,
        allPlaces,
        date,
        sectionId,
        start,
        end,
        departureTime,
        timeZone,
        setError,
    });
    const {
        plan,
        mode,
        setMode,
        orderOnly,
        setOrderOnly,
        busy,
        calculatedTime,
        unavailable,
        recalculate,
    } = route;
    const [selectedPlaceId, setSelectedPlaceId] = useState<number>();
    useEffect(() => {
        setSelectedPlaceId(undefined);
    }, [date, sectionId]);
    const selectedPlace = places.find((p) => p.id === selectedPlaceId);
    function togglePlace(place: Place) {
        setSelectedPlaceId((previous) => (previous === place.id ? undefined : place.id));
    }
    const [initialPosition, setInitialPosition] = useState<MapPlace>();
    const [editingPlace, setEditingPlace] = useState<Place>();
    const [showForm, setShowForm] = useState(false);
    const workspaceRef = useRef<HTMLElement>(null);
    function openCalendar() {
        setCalendarOpen(true);
        requestAnimationFrame(() =>
            workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        );
    }
    function editPlace(place: Place) {
        setEditingPlace(place);
        setShowForm(true);
    }
    function openPlaceForm(position?: MapPlace) {
        if (!date) {
            openCalendar();
            return;
        }
        setInitialPosition(position);
        setEditingPlace(undefined);
        setShowForm(true);
    }
    const placeActions = {
        onSelect: togglePlace,
        onEdit: editPlace,
        onUpdated: updateChecklist,
        onDelete: (place: Place) => data.deletePlace(place.id),
        onDateChange: data.changePlaceDate,
    };
    const dayPlaces = places.filter((p) => p.visit_date === date);
    const dayCount = allPlaces.filter((p) => p.visit_date === date).length;
    const orderedPlaces = orderedPlacesFor(places, date, plan);
    const {
        places: fallbackPlaces,
        middleCount,
        invalidOrder,
    } = fallbackRoute(places, date, start, end);
    const dates = plannerDates(allPlaces, sections, defaultSectionNames, date);
    async function copyItinerary(target: string) {
        const result = await data.copyItinerary({
            source_date: date,
            target_date: target,
            section_id: sectionId,
            start_id: start,
            end_id: end,
        });
        settings.copySection(result);
        setDate(result.target_date);
        section.selectSection(result.target_date, result.section_id);
        setSelectedPlaceId(undefined);
    }
    async function moveDay(target: string) {
        await mutate(async () => {
            await api('/days/move', json('POST', { source_date: date, target_date: target }));
            settings.moveDay(target);
            setDate(target);
        });
    }
    async function deleteDay() {
        await data.runMutation(async () => {
            await api(`/days/${date}`, { method: 'DELETE' });
            route.reset();
            settings.removeDay(
                new Set(allPlaces.filter((p) => p.visit_date === date).map((p) => p.id)),
            );
            setSelectedPlaceId(undefined);
            setSectionId(null);
            data.removeDay(date);
            const remainingDates = dates.filter((d) => d !== date);
            const nextDate = remainingDates.find((d) => d > date) ?? remainingDates.at(-1) ?? '';
            setDate(nextDate);
            setCalendarOpen(!nextDate);
        });
    }
    const dateLabel = !date
        ? '여행 날짜를 선택해 주세요'
        : new Date(`${date}T12:00:00`).toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        });
    return (
        <PlannerLayout>
            <section className="intro">
                <div>
                    <span className="eyebrow">
                        YOUR NEXT LITTLE ADVENTURE
                    </span>
                    <h1>
                        가고 싶은 곳을 모으면,
                        <br />
                        여행이 이어집니다
                        <span>
                            .
                        </span>
                    </h1>
                    <p>
                        장소 사이의 고민은 줄이고, 당신만의 여행을 시작하세요.
                    </p>
                </div>
                <div className="intro-actions">
                    <Badge>
                        <span className={ `status-dot ${live ? 'live' : ''}` } />
                        {
                            live ? 'Valhalla 경로 사용' : 'Valhalla 서버 설정 필요'
                        }
                    </Badge>
                </div>
            </section>
            <section
                className="workspace"
                ref={ workspaceRef }
            >
                <div className="workspace-toolbar">
                    <div className="date-tabs">
                        {
                            dates.map((d, i) => (
                                <button
                                    key={ d }
                                    className={ date === d ? 'selected' : '' }
                                    onClick={ () => setDate(d) }
                                >
                                    <span>
                                        { 'DAY ' }
                                        {
                                            String(i + 1).padStart(2, '0')
                                        }
                                    </span>
                                    {
                                        new Date(`${d}T12:00:00`).toLocaleDateString('ko-KR', {
                                            month: 'numeric',
                                            day: 'numeric',
                                        })
                                    }
                                </button>
                            ))
                        }
                    </div>
                    <label className="date-picker">
                        <CalendarDays size={ 16 } />
                        <input
                            aria-label="계획할 날짜"
                            type="date"
                            value={ date }
                            onChange={ (e) => {
                                if (e.target.value) setDate(e.target.value);
                            } }
                        />
                    </label>
                </div>
                {
                    calendarOpen && (
                        <TripCalendar
                            onClose={ () => setCalendarOpen(false) }
                            key={ date.slice(0, 7) || 'empty' }
                            date={ date }
                            places={ allPlaces }
                            onSelect={ (d) => {
                                setDate(d);
                                setSelectedPlaceId(undefined);
                            } }
                        />
                    )
                }
                {
                    date && (
                        <RouteSectionManager
                            key={ date }
                            date={ date }
                            sectionId={ sectionId }
                            daySections={ daySections }
                            defaultSectionName={ defaultSectionName }
                            allPlaces={ allPlaces }
                            placeCount={ dayPlaces.length }
                            mutating={ mutating }
                            setSectionId={ setSectionId }
                            onSave={ section.saveSection }
                            onDelete={ () =>
                                section.deleteSection(() => {
                                    settings.removeSection();
                                    setSelectedPlaceId(undefined);
                                })
                            }
                        />
                    )
                }
                {
                    !date && (
                        <div className="date-empty">
                            <CalendarDays size={ 26 } />
                            <h2>
                                여행 날짜를 먼저 지정해 주세요
                            </h2>
                            <p>
                                달력에서 날짜를 선택한 뒤 장소를 추가하세요.
                            </p>
                        </div>
                    )
                }
                {
                    date && (
                        <div
                            className="workspace-content"
                            id="section-panel"
                            role="tabpanel"
                            aria-labelledby={ `section-tab-${sectionId ?? 'default'}` }
                        >
                            <section className="itinerary">
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
                                    <ModeSwitch
                                        unavailable={ unavailable }
                                        value={ orderOnly ? 'MAP' : mode }
                                        onChange={ (value) => {
                                            setOrderOnly(value === 'MAP');
                                            if (value !== 'MAP') setMode(value);
                                        } }
                                    />
                                </div>
                                {
                                    Object.entries(unavailable)
                                        .filter(([, reason]) => reason)
                                        .map(([key, reason]) => (
                                            <p
                                                className="mode-unavailable-note"
                                                key={ key }
                                            >
                                                {
                                                    key === 'WALK'
                                                        ? '도보'
                                                        : key === 'DRIVE'
                                                            ? '차량'
                                                            : '대중교통'
                                                }
                                                { ' ' }
                                                { '이용 불가: ' }
                                                {
                                                    reason
                                                }
                                            </p>
                                        ))
                                }
                                {
                                    orderOnly && (
                                        <p className="map-mode-note">
                                            Map · 방문 순서와 위치만 표시합니다. 경로 API는 조회하지
                                            않습니다.
                                        </p>
                                    )
                                }
                                {
                                    invalidOrder && (
                                        <p className="mode-unavailable-note">
                                            { '중간 방문지는 ' }
                                            {
                                                middleCount
                                            }
                                            곳인데 그보다 큰 필수 STEP 번호가 있습니다. 순서 보기에서는 등록
                                            순서로 배치합니다. 장소 수정에서 STEP 번호를 조정해 주세요.
                                        </p>
                                    )
                                }
                                <CopyItineraryForm
                                    count={ dayPlaces.length }
                                    busy={ mutating }
                                    onCopy={ copyItinerary }
                                />
                                <MoveDayForm
                                    key={ date }
                                    date={ date }
                                    count={ dayCount }
                                    busy={ mutating }
                                    onMove={ moveDay }
                                />
                                <DeleteDayForm
                                    key={ `delete-${date}` }
                                    date={ date }
                                    count={ dayCount }
                                    sectionCount={ daySections.length + 1 }
                                    busy={ mutating }
                                    onDelete={ deleteDay }
                                />
                                <RouteSettings
                                    places={ places }
                                    { ...settings }
                                    onEndpointsChange={ settings.setEndpoint }
                                    onSwap={ () => setSelectedPlaceId(undefined) }
                                    hasPlan={ !!plan }
                                    calculatedTime={ calculatedTime }
                                    busy={ busy }
                                    orderOnly={ orderOnly }
                                    mutating={ mutating }
                                    recalculate={ recalculate }
                                />
                                <div className="route-status">
                                    <span>
                                        <Sparkles size={ 14 } />
                                        {
                                            orderOnly
                                                ? 'Map · 등록한 방문 순서'
                                                : busy
                                                    ? '가장 짧은 순서를 찾고 있어요'
                                                    : plan
                                                        ? `${Math.max(0, plan.places.length - 2)}개 방문지 · ${mode === 'TRANSIT' ? '출발 시각 기준 추천 순서' : plan.schedule_feasible ? '시간 조건 반영 순서' : '시간 조건 미충족'}`
                                                        : '장소를 등록해 여행을 시작하세요'
                                        }
                                    </span>
                                    <button
                                        disabled={ busy || orderOnly }
                                        onClick={ recalculate }
                                        aria-label="동선 다시 계산"
                                    >
                                        <RefreshCw
                                            size={ 14 }
                                            className={ busy ? 'spin' : '' }
                                        />
                                    </button>
                                </div>
                                {
                                    plan?.saved_at && (
                                        <p className="saved-route-note">
                                            {
                                                plan.cache_hit ? '저장된 동선' : '계산 후 저장된 동선'
                                            }
                                            { ' ·' }
                                            { " " }
                                            {
                                                new Date(plan.saved_at).toLocaleString('ko-KR')
                                            }
                                            <br />
                                            24시간 동안 같은 일정을 재사용합니다. 최신 경로는 다시 계산을
                                            눌러 확인하세요.
                                        </p>
                                    )
                                }
                                {
                                    error && (
                                        <div
                                            role="alert"
                                            className="error"
                                        >
                                            {
                                                error
                                            }
                                            <button
                                                className="text-button"
                                                onClick={ () =>
                                                    load()
                                                        .then(() => recalculate())
                                                        .catch((e) => setError(e.message))
                                                }
                                            >
                                                다시 시도
                                            </button>
                                        </div>
                                    )
                                }
                                {
                                    plan && !plan.schedule_feasible && (
                                        <div
                                            className="error"
                                            role="alert"
                                        >
                                            <strong>
                                                필수 시각을 지킬 수 없는 일정입니다
                                            </strong>
                                            {
                                                plan.schedule_conflicts.map((message, i) => (
                                                    <p key={ i }>
                                                        {
                                                            message
                                                        }
                                                    </p>
                                                ))
                                            }
                                            <p>
                                                출발 시각·머무르기 시간·방문 장소를 수정해 주세요. 표시된
                                                경로는 조건 미충족 경로입니다.
                                            </p>
                                        </div>
                                    )
                                }
                                {
                                    mode === 'TRANSIT' && plan && (
                                        <p className="transit-note">
                                            {
                                                plan.optimization
                                            }
                                            . 도보·대기·환승을 포함한 이동시간이며, 운행
                                            일정은 변경될 수 있습니다.
                                        </p>
                                    )
                                }
                                {
                                    mode === 'TRANSIT' && error && (
                                        <p className="transit-note">
                                            각 STEP 사이의 Google 길찾기에서 교통편을 확인하세요. 출발
                                            날짜·시각은 Google 지도에서 설정해 주세요.
                                        </p>
                                    )
                                }
                                {
                                    busy ? (
                                        <div className="empty loading">
                                            <Route size={ 28 } />
                                            <p>
                                                여행 동선을 계산하고 있어요…
                                            </p>
                                        </div>
                                    ) : plan ? (
                                        <RouteTimeline
                                            plan={ plan }
                                            selectedId={ selectedPlaceId }
                                            busy={ mutating }
                                            onSelect={ togglePlace }
                                            onEdit={ editPlace }
                                            onUpdated={ updateChecklist }
                                            onDelete={ data.deletePlace }
                                        />
                                    ) : fallbackPlaces.length > 0 ? (
                                        <>
                                            <p className="mode-unavailable-note">
                                                장소는 저장되었습니다. 아래 순서와 지도 마커로 일정을
                                                확인하세요. 이동시간과 필수 시각 준수 여부는 계산하지
                                                않습니다.
                                            </p>
                                            <SavedPlaces
                                                key={ `fallback-${date}` }
                                                expanded
                                                numbered
                                                directionsMode={ mode }
                                                title="방문 순서"
                                                places={ fallbackPlaces }
                                                selectedId={ selectedPlaceId }
                                                busy={ mutating }
                                                { ...placeActions }
                                            />
                                        </>
                                    ) : (
                                        <div className="empty">
                                            <MapPin size={ 26 } />
                                            <p>
                                                {
                                                    loaded
                                                        ? '이 날짜에 갈 장소를 추가하거나 출발·도착지를 선택하세요.'
                                                        : '여행 정보를 불러오는 중입니다.'
                                                }
                                            </p>
                                        </div>
                                    )
                                }
                                <Button
                                    variant="secondary"
                                    className="full add-stop"
                                    onClick={ () => openPlaceForm() }
                                >
                                    <Plus size={ 16 } />
                                    이 구간에 장소 추가
                                </Button>
                                <SavedPlaces
                                    places={ orderedPlaces }
                                    selectedId={ selectedPlaceId }
                                    busy={ mutating }
                                    { ...placeActions }
                                />
                            </section>
                            <RouteOverview
                                plan={ plan }
                                selectedPlace={ selectedPlace }
                                fallbackPlaces={ fallbackPlaces }
                                busy={ busy }
                                onAddPlace={ openPlaceForm }
                            />
                        </div>
                    )
                }
                { ' ' }
            </section>
            <CourseList
                courses={ courses }
                busy={ mutating }
                onAssign={ (course) =>
                    !date ? setCalendarOpen(true) : data.assignCourse(course, date, sectionId)
                }
            />
            {
                !showForm && (
                    <nav
                        className="floating-actions"
                        aria-label="여행 빠른 메뉴"
                    >
                        <button
                            type="button"
                            className="floating-action calendar"
                            title="달력 보기"
                            aria-label="달력 보기"
                            onClick={ openCalendar }
                        >
                            <CalendarDays size={ 21 } />
                            <span>
                                달력 보기
                            </span>
                        </button>
                        <button
                            type="button"
                            className="floating-action add"
                            title="일정 추가"
                            aria-label="일정 추가"
                            onClick={ () => openPlaceForm() }
                        >
                            <Plus size={ 23 } />
                            <span>
                                일정 추가
                            </span>
                        </button>
                    </nav>
                )
            }
            {
                showForm && (
                    <PlaceForm
                        defaultSectionNames={ defaultSectionNames }
                        sectionId={ sectionId }
                        sections={ sections }
                        initialPosition={ editingPlace ? undefined : initialPosition }
                        place={ editingPlace }
                        date={ date }
                        onSaved={ load }
                        onClose={ () => setShowForm(false) }
                    />
                )
            }
        </PlannerLayout>
    );
}
