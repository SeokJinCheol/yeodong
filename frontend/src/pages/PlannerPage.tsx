import { AccountPanel } from '../components/organisms/AccountPanel';
import { TripTools } from '../components/organisms/TripTools';
import { PlannerLayout } from '../components/templates/PlannerLayout';
import { t, locale, translateMessage } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
import { ItineraryProgress } from '../components/organisms/ItineraryProgress';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, MapPin, Plus, RefreshCw, Route, Sparkles } from 'lucide-react';
import { api, json, localDate } from '../lib/api';
import type { MapPlace, Place } from '../lib/types';
import { Button } from '../components/atoms/Button';
import { DeleteDayForm } from '../components/molecules/DeleteDayForm';
import { CopyItineraryForm } from '../components/molecules/CopyItineraryForm';
import { DailyItinerarySettings } from '../components/organisms/DailyItinerarySettings';
import { MoveDayForm } from '../components/molecules/MoveDayForm';
import { Badge } from '../components/atoms/Badge';
import { PlaceForm } from '../components/organisms/PlaceForm';
import { RouteTimeline } from '../components/organisms/RouteTimeline';
import { RouteOverview } from '../components/organisms/RouteOverview';
import { CourseList } from '../components/organisms/CourseList';
import { SavedPlaces } from '../components/organisms/SavedPlaces';
import { TripCalendar } from '../components/organisms/TripCalendar';

import { usePlannerData } from '../hooks/usePlannerData';
import { useRoutePlan } from '../hooks/useRoutePlan';
import { useRouteSettings } from '../hooks/useRouteSettings';
import { useRouteSections } from '../hooks/useRouteSections';
import { fallbackRoute, orderedPlacesFor, plannerDates } from '../lib/planner';
import { RouteSectionManager } from '../components/organisms/RouteSectionManager';
import { RouteSettings } from '../components/organisms/RouteSettings';

export function PlannerPage() {
    useTranslation();
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
    const settings = useRouteSettings(
        places,
        date,
        sectionId,
        data.routeSettings,
        data.savePreferences,
    );
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
        viewMode: settings.viewMode,
    });
    const { plan, mode, orderOnly, busy, calculatedTime, unavailable, recalculate } = route;
    const [selectedPlaceId, setSelectedPlaceId] = useState<number>();
    useEffect(() => {
        setSelectedPlaceId(undefined);
    }, [date, sectionId]);
    const selectedPlace = allPlaces.find((p) => p.id === selectedPlaceId);
    function togglePlace(place: Place) {
        setSelectedPlaceId((previous) => (previous === place.id ? undefined : place.id));
    }
    const [initialPosition, setInitialPosition] = useState<MapPlace>();
    const [editingPlace, setEditingPlace] = useState<Place>();
    const [showForm, setShowForm] = useState(false);
    const workspaceRef = useRef<HTMLElement>(null);
    const mapSectionRef = useRef<HTMLDivElement>(null);
    const stepsSectionRef = useRef<HTMLDivElement>(null);
    const previousScroll = useRef<{ steps?: number; map?: number }>({});
    const [mobileView, setMobileView] = useState<'steps' | 'map'>('steps');
    function jumpTo(target: 'steps' | 'map') {
        previousScroll.current[mobileView] = window.scrollY;
        const remembered = previousScroll.current[target];
        setMobileView(target);
        if (remembered !== undefined) window.scrollTo({ top: remembered, behavior: 'smooth' });
        else
            (target === 'map' ? mapSectionRef : stepsSectionRef).current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
    }
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
        onVisitStatus: data.setVisitStatus,
        onDelete: (place: Place) => data.deletePlace(place.id),
        onDateChange: data.changePlaceDate,
    };
    const dayPlaces = places.filter((p) => p.visit_date === date);
    const dayCount = allPlaces.filter((p) => p.visit_date === date).length;
    const {
        places: fallbackPlaces,
        middleCount,
        invalidOrder,
    } = fallbackRoute(places, date, start, end);
    const dates = plannerDates(allPlaces, sections, defaultSectionNames, date);
    const dateTabsRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const tabs = dateTabsRef.current;
        const selected = tabs?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
        if (!tabs || !selected) return;
        tabs.scrollTo({
            left: selected.offsetLeft - (tabs.clientWidth - selected.offsetWidth) / 2,
        });
    }, [date]);
    async function copyItinerary(target: string) {
        const result = await data.copyItinerary({
            source_date: date,
            target_date: target,
            section_id: sectionId,
            start_id: start,
            end_id: end,
        });
        setDate(result.target_date);
        section.selectSection(result.target_date, result.section_id);
        setSelectedPlaceId(undefined);
    }
    async function reorder(ids: number[], automatic: boolean) {
        if (start === undefined || end === undefined) return;
        await mutate(() =>
            api(
                '/itineraries/order',
                json('PUT', {
                    visit_date: date,
                    section_id: sectionId,
                    start_id: start,
                    end_id: end,
                    place_ids: ids,
                    automatic,
                }),
            ),
        );
    }
    async function moveDay(target: string) {
        await mutate(async () => {
            await api('/days/move', json('POST', { source_date: date, target_date: target }));
            setDate(target);
        });
    }
    async function deleteDay() {
        await data.runMutation(async () => {
            await api(`/days/${date}`, { method: 'DELETE' });
            await data.captureUndo();
            route.reset();
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
        ? t('itinerary.selectDate')
        : new Date(`${date}T12:00:00`).toLocaleDateString(locale(), {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        });
    return (
        <PlannerLayout>
            <AccountPanel />
            <TripTools
                busy={ mutating || busy || data.settingsPending > 0 }
                trash={ data.trash }
                onRestore={ data.restoreTrash }
                runMutation={ data.runMutation }
            />
            {
                data.settingsPending > 0 && (
                    <p
                        role="status"
                        className="settings-saving"
                    >
                        {
                            t('common.status.saving')
                        }
                    </p>
                )
            }
            {
                data.undo && (
                    <div
                        role="status"
                        className="undo-toast"
                    >
                        <span>
                            {
                                t('itinerary.deleted', { name: data.undo.label })
                            }
                        </span>
                        <button
                            disabled={ mutating }
                            onClick={ () =>
                                void data.restoreTrash(data.undo!.id).catch((e) => setError(e.message))
                            }
                        >
                            {
                                t('common.button.undo')
                            }
                        </button>
                        <button
                            aria-label={ t('itinerary.dismissDeleted') }
                            onClick={ () => data.setUndo(undefined) }
                        >
                            ×
                        </button>
                    </div>
                )
            }
            <section className="intro">
                <div>
                    <span className="eyebrow">
                        YOUR NEXT LITTLE ADVENTURE
                    </span>
                    <h1>
                        {
                            t('planner.intro.firstLine')
                        }
                        <br />
                        {
                            t('planner.intro.secondLine')
                        }
                        <span>
                            .
                        </span>
                    </h1>
                    <p>
                        {
                            t('planner.intro.description')
                        }
                    </p>
                </div>
                <div className="intro-actions">
                    <Badge>
                        <span className={ `status-dot ${live ? 'live' : ''}` } />
                        {
                            live ? t('route.status.enabled') : t('route.status.setupRequired')
                        }
                    </Badge>
                </div>
            </section>
            <section
                className="workspace"
                ref={ workspaceRef }
            >
                <div className="workspace-toolbar">
                    <div
                        className="date-tabs"
                        ref={ dateTabsRef }
                        aria-label={ t('itinerary.dateLabel') }
                    >
                        {
                            dates.map((d, i) => (
                                <button
                                    key={ d }
                                    className={ date === d ? 'selected' : '' }
                                    aria-pressed={ date === d }
                                    onClick={ () => setDate(d) }
                                >
                                    <span>
                                        { 'DAY ' }
                                        {
                                            String(i + 1).padStart(2, '0')
                                        }
                                    </span>
                                    {
                                        new Date(`${d}T12:00:00`).toLocaleDateString(locale(), {
                                            month: 'numeric',
                                            day: 'numeric',
                                        })
                                    }
                                </button>
                            ))
                        }
                    </div>
                    <button
                        type="button"
                        className="mobile-date-toggle"
                        aria-label={ t('calendar.selectOtherDate') }
                        aria-expanded={ calendarOpen }
                        onClick={ () => setCalendarOpen((open) => !open) }
                    >
                        <CalendarDays size={ 18 } />
                        {
                            t('common.label.date')
                        }
                    </button>
                    <label className="date-picker">
                        <CalendarDays size={ 16 } />
                        <input
                            aria-label={ t('itinerary.planDate') }
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
                                setCalendarOpen(false);
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
                                {
                                    t('itinerary.noDate.title')
                                }
                            </h2>
                            <p>
                                {
                                    t('itinerary.noDate.description')
                                }
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
                                {
                                    invalidOrder && (
                                        <p className="mode-unavailable-note">
                                            {
                                                t('itinerary.order.outOfRange', { count: middleCount })
                                            }
                                        </p>
                                    )
                                }
                                <DailyItinerarySettings
                                    key={ `${date}:${sectionId}` }
                                    dateLabel={ dateLabel }
                                >
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
                                                    ? t('route.status.mapOrder')
                                                    : busy
                                                        ? t('route.status.optimizing')
                                                        : plan
                                                            ? t('route.status.summary', {
                                                                count: Math.max(0, plan.places.length - 2),
                                                                description:
                                                                    mode === 'TRANSIT'
                                                                        ? t('route.order.departureBased')
                                                                        : plan.schedule_feasible
                                                                            ? t('route.order.feasible')
                                                                            : t('route.order.infeasible'),
                                                            })
                                                            : t('route.empty.startHint')
                                            }
                                        </span>
                                        <button
                                            disabled={ busy || orderOnly }
                                            onClick={ recalculate }
                                            aria-label={ t('route.button.recalculate') }
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
                                                    plan.cache_hit
                                                        ? t('route.cache.saved')
                                                        : t('route.cache.calculated')
                                                }
                                                { ' ·' }
                                                { " " }
                                                {
                                                    new Date(plan.saved_at).toLocaleString(locale())
                                                }
                                                <br />
                                                {
                                                    t('route.cache.hint')
                                                }
                                            </p>
                                        )
                                    }
                                </DailyItinerarySettings>
                                {
                                    error && (
                                        <div
                                            role="alert"
                                            className="error"
                                        >
                                            {
                                                translateMessage(error)
                                            }
                                            <button
                                                className="text-button"
                                                onClick={ () =>
                                                    load()
                                                        .then(() => recalculate())
                                                        .catch((e) => setError(e.message))
                                                }
                                            >
                                                {
                                                    t('common.button.retry')
                                                }
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
                                                {
                                                    t('schedule.infeasible.title')
                                                }
                                            </strong>
                                            {
                                                plan.schedule_conflicts.map((message, i) => (
                                                    <p key={ i }>
                                                        {
                                                            translateMessage(message)
                                                        }
                                                    </p>
                                                ))
                                            }
                                            <p>
                                                {
                                                    t('schedule.infeasible.description')
                                                }
                                            </p>
                                        </div>
                                    )
                                }
                                {
                                    mode === 'TRANSIT' && plan && (
                                        <p className="transit-note">
                                            {
                                                t('transit.scheduleNotice', {
                                                    optimization: plan.optimization,
                                                })
                                            }
                                        </p>
                                    )
                                }
                                {
                                    mode === 'TRANSIT' && error && (
                                        <p className="transit-note">
                                            {
                                                t('transit.fallback.googleHint')
                                            }
                                        </p>
                                    )
                                }
                                <div
                                    ref={ stepsSectionRef }
                                    className="steps-anchor"
                                />
                                <ItineraryProgress
                                    places={ fallbackPlaces }
                                    orderPlaces={ fallbackPlaces }
                                    start={ start }
                                    end={ end }
                                    busy={ busy || mutating }
                                    orderMode={ settings.orderMode }
                                    onOrder={ reorder }
                                    onRemaining={ route.recalculateRemaining }
                                    onAll={ route.recalculateAll }
                                    remainingOnly={ route.remainingOnly }
                                    canCalculate={
                                        !orderOnly && start !== undefined && end !== undefined
                                    }
                                />
                                {
                                    busy ? (
                                        <div className="empty loading">
                                            <Route size={ 28 } />
                                            <p>
                                                {
                                                    t('route.status.calculating')
                                                }
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
                                            onVisitStatus={ data.setVisitStatus }
                                            onDelete={ data.deletePlace }
                                        />
                                    ) : fallbackPlaces.length > 0 ? (
                                        <>
                                            <SavedPlaces
                                                key={ `fallback-${date}` }
                                                expanded
                                                numbered
                                                directionsMode={ mode }
                                                title={ t('route.stopOrder') }
                                                places={ fallbackPlaces }
                                                selectedId={ selectedPlaceId }
                                                busy={ mutating }
                                                { ...placeActions }
                                            />
                                            <p className="mode-unavailable-note">
                                                {
                                                    t('route.orderOnlyHint')
                                                }
                                            </p>
                                        </>
                                    ) : (
                                        <div className="empty">
                                            <MapPin size={ 26 } />
                                            <p>
                                                {
                                                    loaded ? t('route.empty.addPlaces') : t('trip.loading')
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
                                    {
                                        t('section.button.addPlace')
                                    }
                                </Button>
                                <SavedPlaces
                                    places={ orderedPlacesFor(allPlaces, date, plan) }
                                    selectedId={ selectedPlaceId }
                                    busy={ mutating }
                                    { ...placeActions }
                                />
                            </section>
                            <RouteOverview
                                sectionRef={ mapSectionRef }
                                mode={ settings.viewMode }
                                unavailable={ unavailable }
                                onModeChange={ settings.setMode }
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
                        aria-label={ t('planner.shortcuts.label') }
                    >
                        {
                            date && (
                                <button
                                    className="mobile-view-switch"
                                    onClick={ () => jumpTo(mobileView === 'steps' ? 'map' : 'steps') }
                                >
                                    {
                                        mobileView === 'steps'
                                            ? t('planner.shortcuts.map')
                                            : t('planner.shortcuts.steps')
                                    }
                                </button>
                            )
                        }
                        <button
                            type="button"
                            className="floating-action calendar"
                            title={ t('planner.shortcuts.calendar') }
                            aria-label={ t('planner.shortcuts.calendar') }
                            onClick={ openCalendar }
                        >
                            <CalendarDays size={ 21 } />
                            <span>
                                {
                                    t('planner.shortcuts.calendar')
                                }
                            </span>
                        </button>
                        <button
                            type="button"
                            className="floating-action add"
                            title={ t('planner.shortcuts.add') }
                            aria-label={ t('planner.shortcuts.add') }
                            onClick={ () => openPlaceForm() }
                        >
                            <Plus size={ 23 } />
                            <span>
                                {
                                    t('planner.shortcuts.add')
                                }
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
