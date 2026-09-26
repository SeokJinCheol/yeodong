import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../atoms/Button';
import type { Place, RouteSection } from '../../lib/types';
interface Props {
    date: string;
    sectionId: number | null;
    daySections: RouteSection[];
    defaultSectionName: string;
    allPlaces: Place[];
    placeCount: number;
    mutating: boolean;
    setSectionId: (id: number | null) => void;
    onSave: (action: 'add' | 'rename', name: string) => Promise<void>;
    onDelete: () => Promise<void>;
}
export function RouteSectionManager({
    date,
    sectionId,
    daySections,
    defaultSectionName,
    allPlaces,
    placeCount,
    mutating,
    setSectionId,
    onSave,
    onDelete,
}: Props) {
    const [sectionName, setSectionName] = useState('');
    const [managementOpen, setManagementOpen] = useState(false);
    const [sectionAction, setSectionAction] = useState<'add' | 'rename' | 'delete' | null>(null);
    return (
        <section
            className={ `route-sections ${managementOpen ? 'management-open' : ''}` }
            aria-label="날짜별 동선 구간"
        >
            <div className="section-toolbar">
                <div
                    className="section-tabs"
                    role="tablist"
                    aria-label="동선 구간"
                >
                    {
                        [{ id: null, name: defaultSectionName }, ...daySections].map((section) => (
                            <button
                                key={ section.id ?? 'default' }
                                type="button"
                                role="tab"
                                disabled={ mutating }
                                id={ `section-tab-${section.id ?? 'default'}` }
                                aria-selected={ sectionId === section.id }
                                aria-controls="section-panel"
                                onKeyDown={ (e) => {
                                    const tabs = [null, ...daySections.map((s) => s.id)];
                                    const index = tabs.indexOf(section.id);
                                    const next =
                                        e.key === 'ArrowRight'
                                            ? (index + 1) % tabs.length
                                            : e.key === 'ArrowLeft'
                                                ? (index + tabs.length - 1) % tabs.length
                                                : e.key === 'Home'
                                                    ? 0
                                                    : e.key === 'End'
                                                        ? tabs.length - 1
                                                        : null;
                                    if (next !== null) {
                                        e.preventDefault();
                                        setSectionId(tabs[next]);
                                        setSectionAction(null);
                                        document
                                            .getElementById(`section-tab-${tabs[next] ?? 'default'}`)
                                            ?.focus();
                                    }
                                } }
                                tabIndex={ sectionId === section.id ? 0 : -1 }
                                onClick={ () => {
                                    setSectionId(section.id);
                                    setSectionAction(null);
                                } }
                            >
                                {
                                    section.name
                                }
                                <span>
                                    {

                                        allPlaces.filter(
                                            (p) =>
                                                p.visit_date === date &&
                                                (p.section_id ?? null) === section.id,
                                        ).length

                                    }
                                </span>
                            </button>
                        ))
                    }
                </div>
                <button
                    type="button"
                    className="section-management-toggle"
                    aria-label="구간 관리"
                    aria-expanded={ managementOpen }
                    onClick={ () => {
                        setManagementOpen(!managementOpen);
                        setSectionAction(null);
                    } }
                >
                    {
                        managementOpen ? '접기' : '관리'
                    }
                </button>
                <div className="section-actions section-management-actions">
                    <Button
                        variant="secondary"
                        disabled={ mutating }
                        onClick={ () => {
                            setSectionName('');
                            setSectionAction('add');
                        } }
                    >
                        <Plus size={ 15 } />
                        구간 추가
                    </Button>
                    <button
                        type="button"
                        className="text-button"
                        disabled={ mutating }
                        onClick={ () => {
                            setSectionName(
                                sectionId === null
                                    ? defaultSectionName
                                    : (daySections.find((s) => s.id === sectionId)?.name ?? ''),
                            );
                            setSectionAction('rename');
                        } }
                    >
                        이름 변경
                    </button>
                    {
                        sectionId !== null && (
                            <button
                                type="button"
                                className="text-button section-delete"
                                disabled={ mutating }
                                onClick={ () => setSectionAction('delete') }
                            >
                                구간 삭제
                            </button>
                        )
                    }
                </div>
            </div>
            {
                (sectionAction === 'add' || sectionAction === 'rename') && (
                    <form
                        className="section-form"
                        onSubmit={ async (e) => {
                            e.preventDefault();
                            try {
                                await onSave(sectionAction, sectionName);
                                setSectionAction(null);
                            } catch {
                                /* Page displays mutation errors. */
                            }
                        } }
                    >
                        <label htmlFor="section-name">
                            구간 이름
                        </label>
                        <input
                            id="section-name"
                            disabled={ mutating }
                            autoFocus
                            aria-label="구간 이름"
                            placeholder="예: 오전, 오후, 저녁"
                            required
                            maxLength={ 40 }
                            value={ sectionName }
                            onChange={ (e) => setSectionName(e.target.value) }
                        />
                        <Button disabled={ mutating || !sectionName.trim() }>
                            {
                                sectionAction === 'add' ? '추가' : '저장'
                            }
                        </Button>
                        <button
                            type="button"
                            className="text-button"
                            onClick={ () => setSectionAction(null) }
                        >
                            취소
                        </button>
                    </form>
                )
            }
            {
                sectionAction === 'delete' && sectionId !== null && (
                    <div className="section-delete-confirm">
                        <p>
                            <strong>
                                {
                                    daySections.find((s) => s.id === sectionId)?.name
                                }
                            </strong>
                            { ' 구간을 삭제할까요? 등록한 장소 ' }
                            {
                                placeCount
                            }
                            개는 삭제하지 않고 같은 날짜의 ‘
                            {
                                defaultSectionName
                            }
                            ’ 구간으로 옮깁니다.
                        </p>
                        <div className="section-actions">
                            <Button
                                variant="secondary"
                                disabled={ mutating }
                                onClick={ async () => {
                                    try {
                                        await onDelete();
                                        setSectionAction(null);
                                    } catch {
                                        /* Page displays mutation errors. */
                                    }
                                } }
                            >
                                {
                                    mutating ? '처리 중…' : '구간 삭제'
                                }
                            </Button>
                            <button
                                type="button"
                                className="text-button"
                                disabled={ mutating }
                                onClick={ () => setSectionAction(null) }
                            >
                                취소
                            </button>
                        </div>
                    </div>
                )
            }
            <p className="small muted">
                구간마다 방문 장소와 출발·도착지, 동선을 따로 관리합니다. 장소 수정에서 구간을 옮길
                수 있어요.
            </p>
        </section>
    );
}
