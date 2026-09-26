import { useState } from 'react';
import { useAccount } from '../../hooks/useAccount';
import { Button } from '../atoms/Button';
import type { RoutePreferences } from '../../lib/types';

export function AccountPanel() {
    const account = useAccount();
    const [value, setValue] = useState(account.user.preferences);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    async function act(action: () => Promise<void>) {
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await action();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <section
            className="account-panel"
            aria-label="내 계정"
        >
            <span>
                {
                    account.user.display_name
                }
                { ' 님' }
            </span>
            <details>
                <summary>
                    내 기본 설정
                </summary>
                <form
                    onSubmit={ (e) => {
                        e.preventDefault();
                        void act(async () => {
                            await account.savePreferences(value);
                            setMessage('기본 설정을 저장했습니다.');
                        });
                    } }
                >
                    <p className="small muted">
                        별도 설정이 없는 일정에 적용합니다. 이미 저장한 일정 설정은 유지됩니다.
                    </p>
                    <label>
                        기본 출발 시각
                        <input
                            type="time"
                            required
                            value={ value.departureTime }
                            onChange={ (e) => setValue({ ...value, departureTime: e.target.value }) }
                        />
                    </label>
                    <label>
                        기본 시간대
                        <select
                            value={ value.timeZone }
                            onChange={ (e) => setValue({ ...value, timeZone: e.target.value }) }
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
                    <label>
                        기본 이동수단
                        <select
                            value={ value.mode }
                            onChange={ (e) =>
                                setValue({
                                    ...value,
                                    mode: e.target.value as RoutePreferences['mode'],
                                })
                            }
                        >
                            <option value="MAP">
                                Map
                            </option>
                            <option value="WALK">
                                도보
                            </option>
                            <option value="DRIVE">
                                차량
                            </option>
                            <option value="TRANSIT">
                                대중교통
                            </option>
                        </select>
                    </label>
                    <Button disabled={ busy }>
                        기본 설정 저장
                    </Button>
                </form>
            </details>
            <Button
                variant="secondary"
                disabled={ busy }
                onClick={ () => void act(account.logout) }
            >
                로그아웃
            </Button>
            {
                error && (
                    <p
                        className="error"
                        role="alert"
                    >
                        {
                            error
                        }
                    </p>
                )
            }
            {
                message && <p role="status">
                    {
                        message
                    }
                </p>
            }
        </section>
    );
}
