export class ApiError extends Error {
  constructor(message:string, public routeUnavailable:boolean=false){super(message);}
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(typeof data?.detail === 'string' ? data.detail : `요청을 처리하지 못했습니다 (${response.status}). 입력값과 서버 연결을 확인해 주세요.`, response.headers.get('X-Route-Unavailable')==='true');
  }
  return response.status === 204 ? undefined as T : response.json();
}
export const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });
export function minutes(value: number) { const n = Math.round(value); return n >= 60 ? `${Math.floor(n / 60)}시간${n % 60 ? ` ${n % 60}분` : ''}` : `${n}분`; }
export function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
