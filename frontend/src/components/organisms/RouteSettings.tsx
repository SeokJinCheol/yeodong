import { ArrowDownUp } from 'lucide-react';
import type { Place } from '../../lib/types';
interface Props {
    places: Place[];
    start?: number;
    end?: number;
    departureTime: string;
    timeZone: string;
    setDepartureTime: (value: string) => void;
    setTimeZone: (value: string) => void;
    onEndpointsChange: (value: { start: number; end: number }) => void;
    onSwap: () => void;
    hasPlan: boolean;
    calculatedTime: string;
    busy: boolean;
    orderOnly: boolean;
    mutating: boolean;
    recalculate: () => void;
}
export function RouteSettings({
    places,
    start,
    end,
    departureTime,
    timeZone,
    setDepartureTime,
    setTimeZone,
    onEndpointsChange,
    onSwap,
    hasPlan,
    calculatedTime,
    busy,
    orderOnly,
    mutating,
    recalculate,
}: Props) {
    return (
        <>
            <div className="transit-settings">
                <label>
                    여행 출발 시각
                    <input
                        aria-label="여행 출발 시각"
                        type="time"
                        required
                        value={ departureTime }
                        onChange={ (e) => {
                            if (e.target.value) setDepartureTime(e.target.value);
                        } }
                    />
                </label>
                <label>
                    시간대
                    <select
                        aria-label="여행지 시간대"
                        value={ timeZone }
                        onChange={ (e) => setTimeZone(e.target.value) }
                    >
                        <option value="Asia/Tokyo">
                            일본 (도쿄)
                        </option>
                        <option value="Asia/Seoul">
                            한국 (서울)
                        </option>
                        <option value="Asia/Taipei">
                            대만 (타이베이)
                        </option>
                        <option value="Asia/Singapore">
                            싱가포르
                        </option>
                        <option value="Europe/Paris">
                            프랑스 (파리)
                        </option>
                        <option value="Europe/London">
                            영국 (런던)
                        </option>
                        <option value="America/New_York">
                            미국 (뉴욕)
                        </option>
                        <option value="America/Los_Angeles">
                            미국 (LA)
                        </option>
                    </select>
                </label>
                <p>
                    시간대·출발 시각 변경은 자동 재계산하지 않습니다. 적용하려면 동선 다시 계산을
                    눌러 주세요.
                </p>
            </div>
            {
                hasPlan && calculatedTime !== `${departureTime}|${timeZone}` && (
                    <div
                        className="time-pending"
                        role="status"
                    >
                        시간 설정이 변경되었습니다. 현재 동선은 이전 시간 설정으로 계산된 결과입니다.
                        <button
                            type="button"
                            className="text-button"
                            disabled={ busy || orderOnly }
                            onClick={ recalculate }
                        >
                            변경한 시간으로 동선 다시 계산
                        </button>
                    </div>
                )
            }
            <div className="endpoint-selectors">
                <label>
                    <span className="endpoint-dot" />
                    출발
                    <select
                        aria-label="출발지"
                        value={ start ?? '' }
                        onChange={ (e) =>
                            onEndpointsChange({
                                start: Number(e.target.value),
                                end: end ?? Number(e.target.value),
                            })
                        }
                    >
                        <option
                            value=""
                            disabled
                        >
                            출발지 선택
                        </option>
                        {
                            places.map((p) => (
                                <option
                                    value={ p.id }
                                    key={ p.id }
                                >
                                    {
                                        p.name
                                    }
                                </option>
                            ))
                        }
                    </select>
                </label>
                <button
                    type="button"
                    className="swap-endpoints"
                    aria-label="출발지와 도착지 바꾸기"
                    title="출발지와 도착지 바꾸기"
                    disabled={ mutating || start === undefined || end === undefined || start === end }
                    onClick={ () => {
                        if (start === undefined || end === undefined) return;
                        onEndpointsChange({ start: end, end: start });
                        onSwap();
                    } }
                >
                    <ArrowDownUp size={ 15 } />
                </button>
                <label>
                    <span className="endpoint-dot end" />
                    도착
                    <select
                        aria-label="도착지"
                        value={ end ?? '' }
                        onChange={ (e) =>
                            onEndpointsChange({
                                start: start ?? Number(e.target.value),
                                end: Number(e.target.value),
                            })
                        }
                    >
                        <option
                            value=""
                            disabled
                        >
                            도착지 선택
                        </option>
                        {
                            places.map((p) => (
                                <option
                                    value={ p.id }
                                    key={ p.id }
                                >
                                    {
                                        p.name
                                    }
                                </option>
                            ))
                        }
                    </select>
                </label>
            </div>
        </>
    );
}
