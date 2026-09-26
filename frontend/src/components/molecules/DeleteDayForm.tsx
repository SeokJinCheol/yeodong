import { useState } from 'react';
import { Button } from '../atoms/Button';

export function DeleteDayForm({
    date,
    count,
    sectionCount,
    busy,
    onDelete,
}: {
    date: string;
    count: number;
    sectionCount: number;
    busy: boolean;
    onDelete: () => Promise<void>;
}) {
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');
    return (
        <div className="delete-day">
            <button
                type="button"
                className="text-button section-delete"
                disabled={ busy }
                onClick={ () => {
                    setError('');
                    setConfirming(!confirming);
                } }
            >
                이 날짜 일정 전체 삭제
            </button>
            {
                confirming && (
                    <div className="section-delete-confirm">
                        <p>
                            <strong>
                                {
                                    date
                                }
                            </strong>
                            { '의 모든 구간 ' }
                            {
                                sectionCount
                            }
                            { '개와 장소 ' }
                            {
                                count
                            }
                            개를 삭제합니다. 장소의 메모와 할 일도 함께 삭제되며 되돌릴 수 없습니다.
                            다른 날짜와 날짜 미정 장소는 유지됩니다.
                        </p>
                        <div className="section-actions">
                            <Button
                                variant="secondary"
                                disabled={ busy }
                                onClick={ async () => {
                                    setError('');
                                    try {
                                        await onDelete();
                                        setConfirming(false);
                                    } catch (e) {
                                        setError((e as Error).message);
                                    }
                                } }
                            >
                                {
                                    busy ? '삭제 중…' : '이 날짜 일정 영구 삭제'
                                }
                            </Button>
                            <button
                                type="button"
                                className="text-button"
                                disabled={ busy }
                                onClick={ () => setConfirming(false) }
                            >
                                취소
                            </button>
                        </div>
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
                    </div>
                )
            }
        </div>
    );
}
