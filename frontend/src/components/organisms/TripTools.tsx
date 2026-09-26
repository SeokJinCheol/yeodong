import { useState } from 'react';
import { activeTripId, switchTrip } from '../../lib/api';
import { useTripTools } from '../../hooks/useTripTools';
import type { TrashItem } from '../../lib/types';
import { Button } from '../atoms/Button';

export function TripTools({
    busy,
    trash,
    onRestore,
    runMutation,
}: {
    busy: boolean;
    trash: TrashItem[];
    onRestore: (id: number) => Promise<void>;
    runMutation: (action: () => Promise<unknown>) => Promise<void>;
}) {
    const tools = useTripTools(runMutation);
    const [name, setName] = useState('');
    const [restoreError, setRestoreError] = useState('');
    const disabled = busy || tools.busy;
    return (
        <section
            className="trip-tools"
            aria-label="여행 관리"
        >
            <label>
                여행
                <select
                    aria-label="현재 여행"
                    value={ activeTripId }
                    disabled={ disabled }
                    onChange={ (e) => switchTrip(Number(e.target.value)) }
                >
                    {
                        tools.trips.map((trip) => (
                            <option
                                key={ trip.id }
                                value={ trip.id }
                            >
                                {
                                    trip.name
                                }
                            </option>
                        ))
                    }
                </select>
            </label>
            <details>
                <summary>
                    여행·백업·휴지통
                </summary>
                <div className="trip-tools-panel">
                    <form
                        onSubmit={ (e) => {
                            e.preventDefault();
                            void tools.saveTrip(name, true);
                        } }
                    >
                        <label>
                            여행 이름
                            <input
                                aria-label="여행 이름"
                                value={ name }
                                maxLength={ 80 }
                                onChange={ (e) => setName(e.target.value) }
                                placeholder="예: 도쿄 가을 여행"
                            />
                        </label>
                        <div className="tool-actions">
                            <Button disabled={ disabled || !name.trim() }>
                                새 여행 만들기
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={ disabled || !name.trim() }
                                onClick={ () => void tools.saveTrip(name, false) }
                            >
                                현재 여행 이름 변경
                            </Button>
                        </div>
                    </form>
                    <div className="tool-actions">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={ disabled }
                            onClick={ () => void tools.download() }
                        >
                            백업 내려받기
                        </Button>
                        <label className="backup-upload">
                            백업 가져오기
                            <input
                                aria-label="백업 JSON 파일"
                                type="file"
                                accept=".json,application/json"
                                disabled={ disabled }
                                onChange={ async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    await tools.importFile(file);
                                    e.target.value = '';
                                } }
                            />
                        </label>
                    </div>
                    <p className="small muted">
                        현재 여행의 장소·구간·설정을 백업합니다. 가져오기는 기존 일정을 유지하고,
                        날짜가 겹치면 새 구간에 추가합니다. 휴지통은 백업에 포함되지 않습니다.
                    </p>
                    {
                        tools.error && (
                            <p
                                role="alert"
                                className="error"
                            >
                                {
                                    tools.error
                                }
                            </p>
                        )
                    }
                    {
                        tools.success && <p role="status">
                            {
                                tools.success
                            }
                        </p>
                    }
                    <details className="trash-list">
                        <summary>
                            { '휴지통 ' }
                            {
                                trash.length
                            }
                            개
                        </summary>
                        {
                            trash.length === 0 && <p>
                                삭제한 일정이 없습니다.
                            </p>
                        }
                        {
                            trash.map((item) => (
                                <div
                                    className="trash-item"
                                    key={ item.id }
                                >
                                    <span>
                                        {
                                            item.label
                                        }
                                        <small>
                                            {
                                                new Date(item.deleted_at).toLocaleString('ko-KR')
                                            }
                                        </small>
                                    </span>
                                    <Button
                                        variant="secondary"
                                        disabled={ disabled }
                                        onClick={ async () => {
                                            setRestoreError('');
                                            try {
                                                await onRestore(item.id);
                                            } catch (e) {
                                                setRestoreError((e as Error).message);
                                            }
                                        } }
                                    >
                                        복구
                                    </Button>
                                </div>
                            ))
                        }
                        {
                            restoreError && (
                                <p
                                    role="alert"
                                    className="error"
                                >
                                    {
                                        restoreError
                                    }
                                </p>
                            )
                        }
                    </details>
                </div>
            </details>
        </section>
    );
}
