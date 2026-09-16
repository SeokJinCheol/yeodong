import { useState } from 'react';
import { MapPin, Plus, Search, X } from 'lucide-react';
import { api, json } from '../../lib/api';
import type { PlaceInput, Place, MapPlace } from '../../lib/types';
import { Button } from '../atoms/Button';

export function PlaceForm({date, place, initialPosition, onSaved, onClose}: {initialPosition?:MapPlace;place?: Place; date: string; onSaved: () => Promise<void>; onClose: () => void}) {
  const [query,setQuery] = useState('');
  const [results,setResults] = useState<Partial<PlaceInput>[]>([]);
  const [form,setForm] = useState({description:place?.description??'',tasks:place?.tasks??[],name:place?.name??initialPosition?.name??'',lat:place?String(place.lat):initialPosition?String(initialPosition.lat):'',lng:place?String(place.lng):initialPosition?String(initialPosition.lng):'',area:place?.area??'',address:place?.address??initialPosition?.address??'',visit_date:place?(place.visit_date??''):date,stay_minutes:place?.stay_minutes??60,required_time:place?.required_time??'',required_order:place?.required_order?String(place.required_order):'',google_place_id:place?.google_place_id??initialPosition?.google_place_id??null});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function search() {
    setBusy(true); setError('');
    try { setResults(await api<Partial<PlaceInput>[]>(`/search?q=${encodeURIComponent(query)}`)); }
    catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="place-title"><header><div><span className="eyebrow">{place?'EDIT PLACE':'ADD A PLACE'}</span><h2 id="place-title">{place?'장소와 일정 수정':'어디에 가고 싶으세요?'}</h2></div><Button variant="ghost" onClick={onClose} aria-label="닫기"><X size={20}/></Button></header>
    {initialPosition && !place && <p className="map-position-note">지도에서 선택한 위치입니다. 장소 이름을 입력해 저장하세요.</p>}<div className="search-row"><input autoFocus aria-label="Google 장소 검색" placeholder="도시와 장소 검색 · 예: 도쿄 팡메종" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && query.trim().length>=2 && !busy) void search();}}/><Button variant="secondary" disabled={busy || query.trim().length<2} onClick={search}><Search size={16}/>검색</Button></div>
    {results.map((p,i)=><button className="search-result" key={i} onClick={()=>{setForm({...form,name:p.name!,lat:String(p.lat),lng:String(p.lng),address:p.address ?? '',google_place_id:p.google_place_id ?? null});setResults([]);}}><MapPin size={16}/><span>{p.name}<small>{p.address}</small></span></button>)}
    <p className="muted small">Google 검색 결과를 선택하거나, 이름과 좌표를 직접 입력하세요.</p>
    <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try {await api(place?`/places/${place.id}`:'/places',json(place?'PUT':'POST',{...form,lat:Number(form.lat),lng:Number(form.lng),visit_date:form.visit_date || null,required_time:form.required_time || null,required_order:form.required_order?Number(form.required_order):null}));await onSaved();onClose();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
      <label>장소 이름<input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="방문할 장소 이름"/></label>
      <label>장소 설명<textarea rows={3} maxLength={4000} placeholder="추천 메뉴, 예약 정보, 방문 시 참고할 내용을 적어 주세요." value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <fieldset className="task-editor"><legend>이 장소에서 할 일</legend>{form.tasks.map((task,i)=><div className="task-edit-row" key={task.id}>
        <input type="checkbox" aria-label={`할 일 ${i+1} 완료`} checked={task.done} onChange={e=>setForm({...form,tasks:form.tasks.map(t=>t.id===task.id?{...t,done:e.target.checked}:t)})}/>
        <input aria-label={`할 일 ${i+1}`} required maxLength={200} value={task.text} placeholder="할 일을 입력하세요" onChange={e=>setForm({...form,tasks:form.tasks.map(t=>t.id===task.id?{...t,text:e.target.value}:t)})}/>
        <button type="button" className="task-remove" aria-label={`할 일 ${i+1} 삭제`} onClick={()=>setForm({...form,tasks:form.tasks.filter(t=>t.id!==task.id)})}><X size={15}/></button>
      </div>)}<button type="button" className="text-button task-add" disabled={form.tasks.length>=50} onClick={()=>setForm({...form,tasks:[...form.tasks,{id:crypto.randomUUID(),text:'',description:'',done:false}]})}>+ 할 일 추가</button></fieldset>
      <label>주소<input maxLength={500} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
      <div className="form-grid"><label>위도<input required type="number" min="-90" max="90" step="any" value={form.lat} onChange={e=>setForm({...form,lat:e.target.value,google_place_id:null})} placeholder="35.6909"/></label><label>경도<input required type="number" min="-180" max="180" step="any" value={form.lng} onChange={e=>setForm({...form,lng:e.target.value,google_place_id:null})} placeholder="139.7003"/></label></div>
      <div className="form-grid"><label>지역<input value={form.area} maxLength={80} onChange={e=>setForm({...form,area:e.target.value})} placeholder="신주쿠"/></label><label>머무는 시간 (분)<input required type="number" min="0" max="1440" value={form.stay_minutes} onChange={e=>setForm({...form,stay_minutes:Number(e.target.value)})}/></label></div>
      <label>방문 날짜<input type="date" value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})}/></label><button type="button" className="text-button" onClick={()=>setForm({...form,visit_date:''})}>날짜 미정으로 저장하기</button>
      <label>필수 방문 순서 (선택)<input type="number" min="1" max="100" step="1" value={form.required_order} placeholder="자동 배치" onChange={e=>setForm({...form,required_order:e.target.value})}/></label><p className="small muted">입력한 숫자의 STEP에 고정합니다. 예: 3을 입력하면 STEP 03입니다. 비워 둔 장소는 남은 자리에 자동 배치됩니다. 중간 방문지 수보다 큰 숫자나 중복 숫자는 사용할 수 없습니다. 출발·도착지는 항상 처음·마지막이며 이 숫자는 중간 방문지에만 적용됩니다.</p>{form.required_order && <button type="button" className="text-button" onClick={()=>setForm({...form,required_order:''})}>필수 순서 해제</button>}
      <label>필수 도착 시각 (선택)<input type="time" value={form.required_time} onChange={e=>setForm({...form,required_time:e.target.value})}/></label><p className="small muted">예: 12:00에 이곳에 있어야 해요. 일찍 도착하면 이 시각까지 기다린 뒤 머무르기 시간이 시작됩니다. 방문 날짜·여행지 시간대 기준입니다.</p>{form.required_time && <button type="button" className="text-button" onClick={()=>setForm({...form,required_time:''})}>필수 시각 해제</button>}
      {error && <p role="alert" className="error">{error}</p>}<Button className="full" disabled={busy || !form.name.trim()}><Plus size={16}/>{busy ? '처리 중…' : place?'수정 저장하기':'장소 저장하기'}</Button>
    </form></section></div>;
}
