import { ArrowUpRight, MapPin } from 'lucide-react';
import type { Course } from '../../lib/types';
import { minutes } from '../../lib/api';
import { Button } from '../atoms/Button';
export function CourseList({
    courses,
    onAssign,
    busy,
}: {
    courses: Course[];
    onAssign: (course: Course) => void;
    busy: boolean;
}) {
    return (
        <section className="course-section">
            <div className="section-title">
                <div>
                    <span className="eyebrow">
                        A LITTLE INSPIRATION
                    </span>
                    <h2>
                        가까운 장소끼리, 하나의 여행
                    </h2>
                    <p>
                        날짜를 정하지 않은 장소를 2.5 km 이내의 코스로 묶었어요.
                    </p>
                </div>
                <span className="muted small">
                    {
                        courses.length
                    }
                    개의 추천 코스
                </span>
            </div>
            <div className="course-grid">
                {
                    courses.map((course, i) => (
                        <article
                            className={ `course-card course-${i % 3}` }
                            key={ course.id }
                        >
                            <div className="course-top">
                                <span className="course-index">
                                    { 'COURSE ' }
                                    {
                                        String(i + 1).padStart(2, '0')
                                    }
                                </span>
                                <MapPin size={ 20 } />
                            </div>
                            <h3>
                                {
                                    course.title
                                }
                            </h3>
                            <p>
                                {
                                    course.places.map((p) => p.name).join(' → ')
                                }
                            </p>
                            <div className="course-meta">
                                {
                                    course.places.length
                                }
                                { '개 장소 ' }
                                <span>
                                    ·
                                </span>
                                { ' 도보 약' }
                                { " " }
                                {
                                    minutes(course.travel_minutes)
                                }
                                { " " }
                                <span>
                                    ·
                                </span>
                                { ' 머무르기' }
                                { " " }
                                {
                                    minutes(course.stay_minutes)
                                }
                            </div>
                            <Button
                                variant="ghost"
                                disabled={ busy }
                                onClick={ () => onAssign(course) }
                            >
                                선택한 날짜에 담기
                                <ArrowUpRight size={ 16 } />
                            </Button>
                        </article>
                    ))
                }
            </div>
            {
                !courses.length && (
                    <div className="empty">
                        날짜 미정으로 장소를 저장하면 추천 코스가 여기에 나타나요.
                    </div>
                )
            }
            <p className="small muted">
                추천 코스의 시간은 직선거리 기반 추정치입니다. 일정에 담으면 선택한 이동수단으로
                다시 계산합니다.
            </p>
        </section>
    );
}
