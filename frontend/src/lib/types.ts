export type Mode = 'WALK' | 'DRIVE' | 'TRANSIT';
export interface PlaceTask { id:string; text:string; description:string; done:boolean }
export interface PlaceInput { description?:string; tasks?:PlaceTask[]; name: string; lat: number; lng: number; address: string; area: string; visit_date: string | null; stay_minutes: number; required_time?: string | null; required_order?: number | null; google_place_id?: string | null }
export interface Place extends PlaceInput { id: number }
export interface TransitStep { mode: string; duration_seconds: number; distance_meters: number; instruction: string; line: string; line_name: string; vehicle: string; departure_stop: string; arrival_stop: string; departure_time?: string; arrival_time?: string; headsign: string; stop_count?: number; agencies: {name:string;url:string}[] }
export interface Leg { from_id: number; to_id: number; duration_seconds: number; distance_meters: number; mode: Mode; steps: TransitStep[]; departure_time?: string; arrival_time?: string; transfer_count: number; warnings: string[] }
export interface ScheduleStop { leave_by?:string; leave_by_destination?:string; leave_by_required_time?:string; place_id:number; arrival_time:string; visit_start:string; departure_time:string; wait_seconds:number; late_seconds:number; required_time:string|null }
export interface Plan { saved_at?:string; cache_hit?:boolean; schedule:ScheduleStop[]; schedule_feasible:boolean; schedule_conflicts:string[]; total_wait_seconds:number; total_elapsed_seconds:number; places: Place[]; legs: Leg[]; coordinates: number[][]; mode: Mode; total_travel_seconds: number; total_distance_meters: number; total_stay_minutes: number; source: 'google' | 'estimate'; optimization: string; time_zone: string }
export interface Course { id: number; title: string; places: Place[]; distance_meters: number; travel_minutes: number; stay_minutes: number; source: 'estimate' }

export interface MapPlace { lat:number; lng:number; name?:string; address?:string; google_place_id?:string|null }
