import { t } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
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
    useTranslation();
    return (
        <section className="course-section">
            <div className="section-title">
                <div>
                    <span className="eyebrow">
                        A LITTLE INSPIRATION
                    </span>
                    <h2>
                        {
                            t('course.title')
                        }
                    </h2>
                    <p>
                        {
                            t('course.description')
                        }
                    </p>
                </div>
                <span className="muted small">
                    {
                        t('course.count', { count: courses.length })
                    }
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
                                    t('course.summary', {
                                        count: course.places.length,
                                        travel: minutes(course.travel_minutes),
                                        stay: minutes(course.stay_minutes),
                                    })
                                }
                            </div>
                            <Button
                                variant="ghost"
                                disabled={ busy }
                                onClick={ () => onAssign(course) }
                            >
                                {
                                    t('course.button.addToDate')
                                }
                                <ArrowUpRight size={ 16 } />
                            </Button>
                        </article>
                    ))
                }
            </div>
            {
                !courses.length && <div className="empty">
                    {
                        t('course.empty')
                    }
                </div>
            }
            <p className="small muted">
                {
                    t('course.estimateNotice')
                }
            </p>
        </section>
    );
}
