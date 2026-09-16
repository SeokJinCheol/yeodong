import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownUp, CalendarDays, Clock3, MapPin, Plus, RefreshCw, Route, Sparkles } from 'lucide-react';
import { ApiError, api, json, localDate, minutes } from '../lib/api';
import type { Course, Mode, Place, Plan, MapPlace } from '../lib/types';
import { Button } from '../components/atoms/Button';
import { MoveDayForm } from '../components/molecules/MoveDayForm';
import { Badge } from '../components/atoms/Badge';
import { ModeSwitch } from '../components/molecules/ModeSwitch';
import { StatCard } from '../components/molecules/StatCard';
import { PlaceForm } from '../components/organisms/PlaceForm';
import { RouteTimeline } from '../components/organisms/RouteTimeline';
import { RouteMap } from '../components/organisms/RouteMap';
import { CourseList } from '../components/organisms/CourseList';
import { TransitFallback } from '../components/molecules/TransitFallback';
import { SavedPlaces } from '../components/organisms/SavedPlaces';
import { TripCalendar } from '../components/organisms/TripCalendar';
import { PlannerLayout } from '../components/templates/PlannerLayout';

export function PlannerPage() {
  const [places,setPlaces] = useState<Place[]>([]), [courses,setCourses] = useState<Course[]>([]);
  const [departureTime,setDepartureTime] = useState('09:00'), [timeZone,setTimeZone] = useState('Asia/Tokyo');
  const [calculatedTime,setCalculatedTime]=useState('');
  const timeSettings=useRef({departureTime,timeZone});
  timeSettings.current={departureTime,timeZone};
  const [date,setDate] = useState(''), [mode,setMode] = useState<Mode>('WALK');
  const [endpoints,setEndpoints] = useState<Record<string,{start:number;end:number}>>(()=>{
    try { const value=JSON.parse(localStorage.getItem('yeodong-endpoints') || '{}'); return value && typeof value==='object' ? value : {}; } catch { return {}; }
  });
  const [orderOnly,setOrderOnly]=useState(true);
  const [unavailableModes,setUnavailableModes]=useState<Record<string,Partial<Record<Mode,string>>>>({});
  const [selectedPlaceId,setSelectedPlaceId] = useState<number>();
  const [initialPosition,setInitialPosition]=useState<MapPlace>();
  const [editingPlace,setEditingPlace] = useState<Place|undefined>();
  const [plan,setPlan] = useState<Plan|null>(null), [error,setError] = useState('');
  const [busy,setBusy] = useState(false), [mutating,setMutating] = useState(false), [showForm,setShowForm] = useState(false);
  const [loaded,setLoaded] = useState(false), [live,setLive] = useState(false), [revision,setRevision] = useState(0);
  const workspaceRef=useRef<HTMLElement>(null);
  function openCalendar(){
    setCalendarOpen(true);
    requestAnimationFrame(()=>workspaceRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
  }
  const generation = useRef(0);
  const refreshRequested=useRef(false);
  function recalculate(){refreshRequested.current=true;setRevision(x=>x+1);}
  const initialized=useRef(false);
  const [calendarOpen,setCalendarOpen]=useState(false);
  const load = useCallback(async()=>{
    const [p,c,h] = await Promise.all([api<Place[]>('/places'),api<Course[]>('/courses'),api<{google_enabled:boolean}>('/health')]);
    if(!initialized.current){
      initialized.current=true;
      const dates=[...new Set(p.flatMap(place=>place.visit_date?[place.visit_date]:[]))].sort();
      const initial=dates.find(d=>d>=localDate())??dates.at(-1)??'';
      setDate(initial);setCalendarOpen(!initial);
    }
    setPlaces(p);setPlan(previous=>previous?{...previous,places:previous.places.map(old=>p.find(item=>item.id===old.id)??old)}:null);setCourses(c);setLive(h.google_enabled);setLoaded(true);
  },[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  const routingKey=JSON.stringify(places.map(({id,lat,lng,visit_date,stay_minutes,required_order,required_time})=>({id,lat,lng,visit_date,stay_minutes,required_order,required_time})));
  function updateChecklist(updated:Place) {
    setPlaces(previous=>previous.map(p=>p.id===updated.id?updated:p));
    setPlan(previous=>previous?{...previous,places:previous.places.map(p=>p.id===updated.id?updated:p)}:null);
  }
  const dayPlaces = places.filter(p=>p.visit_date===date);
  const selectedPlace=places.find(p=>p.id===selectedPlaceId);
  const orderedPlaces=[...places].sort((a,b)=>{
    if(a.visit_date===date && b.visit_date!==date)return -1;
    if(b.visit_date===date && a.visit_date!==date)return 1;
    if(a.visit_date===date && b.visit_date===date && plan){
      const ai=plan.places.findIndex(p=>p.id===a.id),bi=plan.places.findIndex(p=>p.id===b.id);
      if(ai>=0 && bi>=0)return ai-bi;
    }
    return (a.visit_date??'9999').localeCompare(b.visit_date??'9999') || (a.required_order??101)-(b.required_order??101) || a.id-b.id;
  });
  const selected = endpoints[date];
  const start = selected && places.some(p=>p.id===selected.start) ? selected.start : dayPlaces[0]?.id;
  const end = selected && places.some(p=>p.id===selected.end) ? selected.end : dayPlaces.at(-1)?.id;
  useEffect(()=>{
    if(start!==undefined && end!==undefined && (selected?.start!==start || selected?.end!==end)) {
      setEndpoints(previous=>({...previous,[date]:{start,end}}));
    }
  },[date,start,end,selected]);
  useEffect(()=>{try {localStorage.setItem('yeodong-endpoints',JSON.stringify(endpoints));} catch { /* Storage may be unavailable in private browsing. */ }},[endpoints]);
  const availabilityKey=JSON.stringify([routingKey,date,start,end,departureTime,timeZone]);
  const unavailable=unavailableModes[availabilityKey]??{};
  const middlePlaces=dayPlaces.filter(p=>p.id!==start && p.id!==end);
  const slots:Array<Place|undefined>=Array(middlePlaces.length).fill(undefined);
  const unplaced:Place[]=[];
  middlePlaces.forEach(p=>{const slot=(p.required_order??0)-1;if(slot>=0 && slot<slots.length && !slots[slot])slots[slot]=p;else unplaced.push(p);});
  const fallbackPlaces=[...(start!==undefined?[places.find(p=>p.id===start)!]:[]),...slots.map(p=>p??unplaced.shift()!),...(end!==undefined?[places.find(p=>p.id===end)!]:[])];
  const invalidOrder=middlePlaces.some(p=>p.required_order && p.required_order>middlePlaces.length);

  const dates = [...new Set([...(date?[date]:[]),...places.flatMap(p=>p.visit_date?[p.visit_date]:[])])].sort();
  useEffect(()=>{
    const seq = ++generation.current;
    setPlan(null);
    if(orderOnly){setBusy(false);setError('');return;}
    if(!date || start===undefined || end===undefined) {setBusy(false);return;}
    if(unavailable[mode] && !refreshRequested.current){setError(unavailable[mode]!);setBusy(false);return;}
    setBusy(true);setError('');
    const requestedTime={...timeSettings.current};
    const timer = setTimeout(()=>{
      const forceRefresh=refreshRequested.current;refreshRequested.current=false;
      api<Plan>('/plan',json('POST',{force_refresh:forceRefresh,visit_date:date,start_id:start,end_id:end,mode,departure_time:requestedTime.departureTime,time_zone:requestedTime.timeZone}))
        .then(p=>{if(seq===generation.current){setPlan(p);setUnavailableModes(previous=>({...previous,[availabilityKey]:{...previous[availabilityKey],[mode]:undefined}}));setCalculatedTime(`${requestedTime.departureTime}|${requestedTime.timeZone}`);}})
        .catch(e=>{if(seq===generation.current){setError(e.message);if(e instanceof ApiError && e.routeUnavailable)setUnavailableModes(previous=>({...previous,[availabilityKey]:{...previous[availabilityKey],[mode]:e.message}}));}})
        .finally(()=>{if(seq===generation.current)setBusy(false);});
    },350);
    return ()=>{clearTimeout(timer);generation.current++;};
  },[routingKey,date,start,end,mode,revision,orderOnly]);
  async function mutate(action:()=>Promise<unknown>) {setMutating(true);setError('');try{await action();await load();}catch(e){setError((e as Error).message);}finally{setMutating(false);}}
  const dateLabel = !date?'여행 날짜를 선택해 주세요':new Date(`${date}T12:00:00`).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
  return <PlannerLayout><section className="intro"><div><span className="eyebrow">YOUR NEXT LITTLE ADVENTURE</span><h1>가고 싶은 곳을 모으면,<br/>여행이 이어집니다<span>.</span></h1><p>장소 사이의 고민은 줄이고, 당신만의 여행을 시작하세요.</p></div><div className="intro-actions"><Badge><span className={`status-dot ${live?'live':''}`}/>{live?'Google 경로 연결됨':'데모 · 도쿄 샘플로 시작'}</Badge></div></section>
    <section className="workspace" ref={workspaceRef}><div className="workspace-toolbar"><div className="date-tabs">{dates.map((d,i)=><button key={d} className={date===d?'selected':''} onClick={()=>setDate(d)}><span>DAY {String(i+1).padStart(2,'0')}</span>{new Date(`${d}T12:00:00`).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})}</button>)}</div><label className="date-picker"><CalendarDays size={16}/><input aria-label="계획할 날짜" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label></div>
    {calendarOpen && <TripCalendar onClose={()=>setCalendarOpen(false)} key={date.slice(0,7)||'empty'} date={date} places={places} onSelect={d=>{setDate(d);setSelectedPlaceId(undefined);}}/>}
    {!date && <div className="date-empty"><CalendarDays size={26}/><h2>여행 날짜를 먼저 지정해 주세요</h2><p>달력에서 날짜를 선택한 뒤 장소를 추가하세요.</p></div>}
    {date && <div className="workspace-content"><section className="itinerary"><div className="itinerary-title"><div><span className="eyebrow">DAILY ITINERARY</span><h2>{dateLabel}</h2></div><ModeSwitch unavailable={unavailable} value={orderOnly?'MAP':mode} onChange={value=>{setOrderOnly(value==='MAP');if(value!=='MAP')setMode(value);}}/></div>
      {Object.entries(unavailable).filter(([,reason])=>reason).map(([key,reason])=><p className="mode-unavailable-note" key={key}>{key==='WALK'?'도보':key==='DRIVE'?'차량':'대중교통'} 이용 불가: {reason}</p>)}
      {orderOnly && <p className="map-mode-note">Map · 방문 순서와 위치만 표시합니다. 경로 API는 조회하지 않습니다.</p>}
      {invalidOrder && <p className="mode-unavailable-note">중간 방문지는 {middlePlaces.length}곳인데 그보다 큰 필수 STEP 번호가 있습니다. 순서 보기에서는 등록 순서로 배치합니다. 장소 수정에서 STEP 번호를 조정해 주세요.</p>}
      <MoveDayForm key={date} date={date} count={dayPlaces.length} busy={mutating} onMove={async target=>{
        setMutating(true);setError('');
        try {
          await api('/days/move',json('POST',{source_date:date,target_date:target}));
          setEndpoints(previous=>{const next={...previous};delete next[date];if(start!==undefined && end!==undefined)next[target]={start,end};return next;});
          setDate(target);await load();
        } catch(e) {setError((e as Error).message);} finally {setMutating(false);}
      }}/>
      <div className="transit-settings"><label>여행 출발 시각<input aria-label="여행 출발 시각" type="time" required value={departureTime} onChange={e=>{if(e.target.value)setDepartureTime(e.target.value);}}/></label><label>시간대<select aria-label="여행지 시간대" value={timeZone} onChange={e=>setTimeZone(e.target.value)}><option value="Asia/Tokyo">일본 (도쿄)</option><option value="Asia/Seoul">한국 (서울)</option><option value="Asia/Taipei">대만 (타이베이)</option><option value="Asia/Singapore">싱가포르</option><option value="Europe/Paris">프랑스 (파리)</option><option value="Europe/London">영국 (런던)</option><option value="America/New_York">미국 (뉴욕)</option><option value="America/Los_Angeles">미국 (LA)</option></select></label><p>시간대·출발 시각 변경은 자동 재계산하지 않습니다. 적용하려면 동선 다시 계산을 눌러 주세요.</p></div>
      {plan && calculatedTime!==`${departureTime}|${timeZone}` && <div className="time-pending" role="status">시간 설정이 변경되었습니다. 현재 동선은 이전 시간 설정으로 계산된 결과입니다.<button type="button" className="text-button" disabled={busy || orderOnly} onClick={recalculate}>변경한 시간으로 동선 다시 계산</button></div>}
      <div className="endpoint-selectors"><label><span className="endpoint-dot"/>출발<select aria-label="출발지" value={start??''} onChange={e=>setEndpoints({...endpoints,[date]:{start:Number(e.target.value),end:end??Number(e.target.value)}})}><option value="" disabled>출발지 선택</option>{places.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><button type="button" className="swap-endpoints" aria-label="출발지와 도착지 바꾸기" title="출발지와 도착지 바꾸기" disabled={mutating || start===undefined || end===undefined || start===end} onClick={()=>{
        if(start===undefined || end===undefined)return;
        setEndpoints(previous=>({...previous,[date]:{start:end,end:start}}));
        setSelectedPlaceId(undefined);
      }}><ArrowDownUp size={15}/></button><label><span className="endpoint-dot end"/>도착<select aria-label="도착지" value={end??''} onChange={e=>setEndpoints({...endpoints,[date]:{start:start??Number(e.target.value),end:Number(e.target.value)}})}><option value="" disabled>도착지 선택</option>{places.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label></div>
      <div className="route-status"><span><Sparkles size={14}/>{orderOnly?'Map · 등록한 방문 순서':busy?'가장 짧은 순서를 찾고 있어요':plan?`${Math.max(0,plan.places.length-2)}개 방문지 · ${mode==='TRANSIT'?'출발 시각 기준 추천 순서':plan.schedule_feasible?'시간 조건 반영 순서':'시간 조건 미충족'}`:'장소를 등록해 여행을 시작하세요'}</span><button disabled={busy || orderOnly} onClick={recalculate} aria-label="동선 다시 계산"><RefreshCw size={14} className={busy?'spin':''}/></button></div>
      {plan?.saved_at && <p className="saved-route-note">{plan.cache_hit?'저장된 동선':'계산 후 저장된 동선'} · {new Date(plan.saved_at).toLocaleString('ko-KR')}<br/>24시간 동안 같은 일정을 재사용합니다. 최신 경로는 다시 계산을 눌러 확인하세요.</p>}
      {error && <div role="alert" className="error">{error}<button className="text-button" onClick={()=>load().then(()=>recalculate()).catch(e=>setError(e.message))}>다시 시도</button></div>}
      {plan && !plan.schedule_feasible && <div className="error" role="alert"><strong>필수 시각을 지킬 수 없는 일정입니다</strong>{plan.schedule_conflicts.map((message,i)=><p key={i}>{message}</p>)}<p>출발 시각·머무르기 시간·방문 장소를 수정해 주세요. 표시된 경로는 조건 미충족 경로입니다.</p></div>}
      {mode==='TRANSIT' && plan && <p className="transit-note">{plan.optimization}. 도보·대기·환승을 포함한 이동시간이며, 운행 일정은 변경될 수 있습니다.</p>}
      {mode==='TRANSIT' && error && start!==undefined && end!==undefined && <TransitFallback places={[places.find(p=>p.id===start)!,...orderedPlaces.filter(p=>p.visit_date===date && p.id!==start && p.id!==end),places.find(p=>p.id===end)!]}/>}
      {busy ? <div className="empty loading"><Route size={28}/><p>여행 동선을 계산하고 있어요…</p></div> : plan ? <RouteTimeline plan={plan} onUpdated={updateChecklist} selectedId={selectedPlaceId} onSelect={p=>setSelectedPlaceId(p.id)} busy={mutating} onEdit={place=>{setEditingPlace(place);setShowForm(true);}} onDelete={id=>mutate(()=>api(`/places/${id}`,{method:'DELETE'}))}/> : fallbackPlaces.length>0 ? <><p className="mode-unavailable-note">장소는 저장되었습니다. 아래 순서와 지도 마커로 일정을 확인하세요. 이동시간과 필수 시각 준수 여부는 계산하지 않습니다.</p><SavedPlaces key={`fallback-${date}`} expanded numbered title="방문 순서" places={fallbackPlaces} selectedId={selectedPlaceId} busy={mutating} onSelect={p=>setSelectedPlaceId(p.id)} onEdit={p=>{setEditingPlace(p);setShowForm(true);}} onDateChange={(p,value)=>mutate(()=>api(`/places/${p.id}`,json('PUT',{...p,visit_date:value||null})))} onDelete={p=>mutate(()=>api(`/places/${p.id}`,{method:'DELETE'}))} onUpdated={updateChecklist}/></> : <div className="empty"><MapPin size={26}/><p>{loaded?'이 날짜에 갈 장소를 추가하거나 출발·도착지를 선택하세요.':'여행 정보를 불러오는 중입니다.'}</p></div>}
      <Button variant="secondary" className="full add-stop" onClick={()=>{if(!date){setCalendarOpen(true);return;}setInitialPosition(undefined);setEditingPlace(undefined);setShowForm(true);}}><Plus size={16}/>이 날짜에 장소 추가</Button>
      <SavedPlaces places={orderedPlaces} selectedId={selectedPlaceId} busy={mutating}
        onSelect={p=>setSelectedPlaceId(p.id)} onEdit={p=>{setEditingPlace(p);setShowForm(true);}}
        onDateChange={(p,value)=>mutate(()=>api(`/places/${p.id}`,json('PUT',{...p,visit_date:value||null})))}
        onDelete={p=>mutate(()=>api(`/places/${p.id}`,{method:'DELETE'}))} onUpdated={updateChecklist}/>

    </section><div className="map-column"><div className="stats"><StatCard icon={<Route size={15}/>} label="총 이동시간" value={plan?minutes(plan.total_travel_seconds/60):'—'}/><StatCard icon={<MapPin size={15}/>} label="총 이동거리" value={plan?`${(plan.total_distance_meters/1000).toFixed(1)} km`:'—'}/><StatCard icon={<Clock3 size={15}/>} label="이동 + 대기 + 머무르기" value={plan?minutes(plan.total_elapsed_seconds/60):'—'}/></div><RouteMap onAddPlace={position=>{setInitialPosition(position);setEditingPlace(undefined);setShowForm(true);}} plan={plan} selectedPlace={selectedPlace} fallbackPlaces={!busy?fallbackPlaces:[]}/>{plan && <p className="schedule-summary">대기 {minutes(plan.total_wait_seconds/60)} · 마지막 도착 {new Date(plan.schedule.at(-1)!.visit_start).toLocaleString('ko-KR',{timeZone:plan.time_zone,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</p>}<div className="tip"><Sparkles size={17}/><p><strong>한 걸음 더 여유로운 여행</strong><br/>{plan?.source==='google'?'장소를 추가하면 출발지와 도착지를 유지하며 동선을 다시 계산해요.':'데모의 이동시간은 도보 4.5 km/h, 차량 25 km/h 기준 추정입니다.'}</p></div></div></div>} </section>
    <CourseList courses={courses} busy={mutating} onAssign={course=>!date?setCalendarOpen(true):mutate(()=>api('/courses/assign',json('POST',{place_ids:course.places.map(p=>p.id),visit_date:date})))}/>
    {!showForm && <nav className="floating-actions" aria-label="여행 빠른 메뉴">
      <button type="button" className="floating-action calendar" title="달력 보기" aria-label="달력 보기" onClick={openCalendar}><CalendarDays size={21}/><span>달력 보기</span></button>
      <button type="button" className="floating-action add" title="일정 추가" aria-label="일정 추가" onClick={()=>{if(!date){openCalendar();return;}setInitialPosition(undefined);setEditingPlace(undefined);setShowForm(true);}}><Plus size={23}/><span>일정 추가</span></button>
    </nav>}
    {showForm && <PlaceForm initialPosition={editingPlace?undefined:initialPosition} place={editingPlace} date={date} onSaved={load} onClose={()=>setShowForm(false)}/>}
  </PlannerLayout>;
}
