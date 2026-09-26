import { useState } from 'react';
import { Button } from '../atoms/Button';

export function CopyItineraryForm({
    count,
    busy,
    onCopy,
}: {
    count: number;
    busy: boolean;
    onCopy: (target: string) => Promise<void>;
}) {
    const [target, setTarget] = useState('');
    const [error, setError] = useState('');
    return (
        <details className="move-day copy-itinerary">
            <summary>
                선택한 구간 복사
            </summary>
            <form
                onSubmit={ async (e) => {
                    e.preventDefault();
                    setError('');
                    try {
                        await onCopy(target);
                    } catch (e) {
                        setError((e as Error).message);
                    }
                } }
            >
                <p>
                    현재 구간의 장소와 출발·도착지, 메모·체크리스트, 순서·시간 설정을 복사합니다.
                    원본은 유지하며, 이미 일정이 있는 날짜에는 ‘복사된 일정’ 구간으로 추가합니다.
                </p>
                <label>
                    복사할 날짜
                    <input
                        aria-label="일정 복사할 날짜"
                        type="date"
                        required
                        value={ target }
                        disabled={ busy }
                        onChange={ (e) => setTarget(e.target.value) }
                    />
                </label>
                {
                    error && (
                        <p
                            role="alert"
                            className="error"
                        >
                            {
                                error
                            }
                        </p>
                    )
                }
                <Button
                    variant="secondary"
                    disabled={ busy || !count || !target }
                >
                    {
                        busy ? '복사 중…' : '일정 복사하기'
                    }
                </Button>
            </form>
        </details>
    );
}
