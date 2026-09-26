import { t, translateMessage } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { useEffect, useId, useRef, useState } from 'react';
import { MapPin, Plus, Search, X } from 'lucide-react';
import { api, json } from '../../lib/api';
import type { PlaceInput, Place, MapPlace, RouteSection } from '../../lib/types';
import { Button } from '../atoms/Button';

export function PlaceForm({
    active = true,
    date,
    defaultSectionNames,
    sectionId,
    sections,
    place,
    initialPosition,
    onSaved,
    onClose,
}: {
    active?: boolean;
    defaultSectionNames: Record<string, string>;
    sectionId: number | null;
    sections: RouteSection[];
    initialPosition?: MapPlace;
    place?: Place;
    date: string;
    onSaved: () => Promise<void>;
    onClose: () => void;
}) {
    useTranslation();
    const formId = useId();
    const backdropRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!active) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const viewport = window.visualViewport;
        function updateViewport() {
            if (!viewport || !backdropRef.current) return;
            backdropRef.current.style.height = `${viewport.height}px`;
            backdropRef.current.style.top = `${viewport.offsetTop}px`;
        }
        updateViewport();
        viewport?.addEventListener('resize', updateViewport);
        viewport?.addEventListener('scroll', updateViewport);
        return () => {
            document.body.style.overflow = previousOverflow;
            viewport?.removeEventListener('resize', updateViewport);
            viewport?.removeEventListener('scroll', updateViewport);
        };
    }, [active]);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Partial<PlaceInput>[]>([]);
    const [form, setForm] = useState({
        visit_status: place?.visit_status ?? 'pending',
        section_id: place ? (place.section_id ?? null) : sectionId,
        description: place?.description ?? '',
        tasks: place?.tasks ?? [],
        name: place?.name ?? initialPosition?.name ?? '',
        lat: place ? String(place.lat) : initialPosition ? String(initialPosition.lat) : '',
        lng: place ? String(place.lng) : initialPosition ? String(initialPosition.lng) : '',
        area: place?.area ?? '',
        address: place?.address ?? initialPosition?.address ?? '',
        visit_date: place ? (place.visit_date ?? '') : date,
        stay_minutes: place?.stay_minutes ?? 60,
        required_time: place?.required_time ?? '',
        required_order: place?.required_order ? String(place.required_order) : '',
        google_place_id: place?.google_place_id ?? initialPosition?.google_place_id ?? null,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function search() {
        setBusy(true);
        setError('');
        try {
            setResults(await api<Partial<PlaceInput>[]>(`/search?q=${encodeURIComponent(query)}`));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <div
            className="modal-backdrop"
            ref={ backdropRef }
        >
            <section
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="place-title"
            >
                <header>
                    <div>
                        <span className="eyebrow">
                            {
                                place ? 'EDIT PLACE' : 'ADD A PLACE'
                            }
                        </span>
                        <h2 id="place-title">
                            {
                                place ? t('place.form.editTitle') : t('place.form.addTitle')
                            }
                        </h2>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={ onClose }
                        aria-label={ t('common.button.close') }
                    >
                        <X size={ 20 } />
                    </Button>
                </header>
                <div className="modal-body">
                    {
                        initialPosition && !place && (
                            <p className="map-position-note">
                                {
                                    t('place.form.mapPositionNotice')
                                }
                            </p>
                        )
                    }
                    <div className="search-row">
                        <input
                            aria-label={ t('place.search.label') }
                            placeholder={ t('place.search.placeholder') }
                            value={ query }
                            onChange={ (e) => setQuery(e.target.value) }
                            onKeyDown={ (e) => {
                                if (e.key === 'Enter' && query.trim().length >= 2 && !busy)
                                    void search();
                            } }
                        />
                        <Button
                            variant="secondary"
                            disabled={ busy || query.trim().length < 2 }
                            onClick={ search }
                        >
                            <Search size={ 16 } />
                            {
                                t('common.button.search')
                            }
                        </Button>
                    </div>
                    {
                        results.map((p, i) => (
                            <button
                                className="search-result"
                                key={ i }
                                onClick={ () => {
                                    setForm({
                                        ...form,
                                        name: p.name!,
                                        lat: String(p.lat),
                                        lng: String(p.lng),
                                        address: p.address ?? '',
                                        google_place_id: p.google_place_id ?? null,
                                    });
                                    setResults([]);
                                } }
                            >
                                <MapPin size={ 16 } />
                                <span>
                                    {
                                        p.name
                                    }
                                    <small>
                                        {
                                            p.address
                                        }
                                    </small>
                                </span>
                            </button>
                        ))
                    }
                    <p className="muted small">
                        {
                            t('place.search.description')
                        }
                    </p>
                    <p className="small muted">
                        {
                            t('place.search.attribution')
                        }
                        { ' ' }
                        <a
                            href="https://www.openstreetmap.org/copyright"
                            target="_blank"
                            rel="noreferrer"
                        >
                            OpenStreetMap
                        </a>
                        { ' ' }
                        contributors · Photon
                    </p>
                    <form
                        id={ formId }
                        onSubmit={ async (e) => {
                            e.preventDefault();
                            setBusy(true);
                            setError('');
                            try {
                                await api(
                                    place ? `/places/${place.id}` : '/places',
                                    json(place ? 'PUT' : 'POST', {
                                        ...form,
                                        lat: Number(form.lat),
                                        lng: Number(form.lng),
                                        visit_date: form.visit_date || null,
                                        required_time: form.required_time || null,
                                        required_order: form.required_order
                                            ? Number(form.required_order)
                                            : null,
                                    }),
                                );
                                await onSaved();
                                onClose();
                            } catch (err) {
                                setError((err as Error).message);
                            } finally {
                                setBusy(false);
                            }
                        } }
                    >
                        <label>
                            {
                                t('place.form.name')
                            }
                            <input
                                required
                                maxLength={ 120 }
                                value={ form.name }
                                onChange={ (e) => setForm({ ...form, name: e.target.value }) }
                                placeholder={ t('place.form.namePlaceholder') }
                            />
                        </label>
                        <label>
                            {
                                t('place.form.notes')
                            }
                            <textarea
                                rows={ 3 }
                                maxLength={ 4000 }
                                placeholder={ t('place.form.notesPlaceholder') }
                                value={ form.description }
                                onChange={ (e) => setForm({ ...form, description: e.target.value }) }
                            />
                        </label>
                        <fieldset className="task-editor">
                            <legend>
                                {
                                    t('place.checklist.title')
                                }
                            </legend>
                            {
                                form.tasks.map((task, i) => (
                                    <div
                                        className="task-edit-row"
                                        key={ task.id }
                                    >
                                        <input
                                            type="checkbox"
                                            aria-label={ t('place.checklist.completeItem', {
                                                number: i + 1,
                                            }) }
                                            checked={ task.done }
                                            onChange={ (e) =>
                                                setForm({
                                                    ...form,
                                                    tasks: form.tasks.map((t) =>
                                                        t.id === task.id
                                                            ? { ...t, done: e.target.checked }
                                                            : t,
                                                    ),
                                                })
                                            }
                                        />
                                        <input
                                            aria-label={ t('place.checklist.item', { number: i + 1 }) }
                                            required
                                            maxLength={ 200 }
                                            value={ task.text }
                                            placeholder={ t('place.checklist.placeholder') }
                                            onChange={ (e) =>
                                                setForm({
                                                    ...form,
                                                    tasks: form.tasks.map((t) =>
                                                        t.id === task.id
                                                            ? { ...t, text: e.target.value }
                                                            : t,
                                                    ),
                                                })
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="task-remove"
                                            aria-label={ t('place.checklist.deleteItem', {
                                                number: i + 1,
                                            }) }
                                            onClick={ () =>
                                                setForm({
                                                    ...form,
                                                    tasks: form.tasks.filter((t) => t.id !== task.id),
                                                })
                                            }
                                        >
                                            <X size={ 15 } />
                                        </button>
                                    </div>
                                ))
                            }
                            <button
                                type="button"
                                className="text-button task-add"
                                disabled={ form.tasks.length >= 50 }
                                onClick={ () =>
                                    setForm({
                                        ...form,
                                        tasks: [
                                            ...form.tasks,
                                            {
                                                id: crypto.randomUUID(),
                                                text: '',
                                                description: '',
                                                done: false,
                                            },
                                        ],
                                    })
                                }
                            >
                                {
                                    t('place.checklist.add')
                                }
                            </button>
                        </fieldset>
                        <label>
                            {
                                t('place.form.address')
                            }
                            <input
                                maxLength={ 500 }
                                value={ form.address }
                                onChange={ (e) => setForm({ ...form, address: e.target.value }) }
                            />
                        </label>
                        <div className="form-grid">
                            <label>
                                {
                                    t('place.form.latitude')
                                }
                                <input
                                    required
                                    type="number"
                                    min="-90"
                                    max="90"
                                    step="any"
                                    value={ form.lat }
                                    onChange={ (e) =>
                                        setForm({
                                            ...form,
                                            lat: e.target.value,
                                            google_place_id: null,
                                        })
                                    }
                                    placeholder="35.6909"
                                />
                            </label>
                            <label>
                                {
                                    t('place.form.longitude')
                                }
                                <input
                                    required
                                    type="number"
                                    min="-180"
                                    max="180"
                                    step="any"
                                    value={ form.lng }
                                    onChange={ (e) =>
                                        setForm({
                                            ...form,
                                            lng: e.target.value,
                                            google_place_id: null,
                                        })
                                    }
                                    placeholder="139.7003"
                                />
                            </label>
                        </div>
                        <div className="form-grid">
                            <label>
                                {
                                    t('place.form.area')
                                }
                                <input
                                    value={ form.area }
                                    maxLength={ 80 }
                                    onChange={ (e) => setForm({ ...form, area: e.target.value }) }
                                    placeholder={ t('place.form.areaPlaceholder') }
                                />
                            </label>
                            <label>
                                {
                                    t('place.form.stayMinutes')
                                }
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    max="1440"
                                    value={ form.stay_minutes }
                                    onChange={ (e) =>
                                        setForm({ ...form, stay_minutes: Number(e.target.value) })
                                    }
                                />
                            </label>
                        </div>
                        <label>
                            {
                                t('place.form.visitDate')
                            }
                            <input
                                type="date"
                                value={ form.visit_date }
                                onChange={ (e) =>
                                    setForm({
                                        ...form,
                                        visit_date: e.target.value,
                                        section_id: null,
                                    })
                                }
                            />
                        </label>
                        <button
                            type="button"
                            className="text-button"
                            onClick={ () => setForm({ ...form, visit_date: '', section_id: null }) }
                        >
                            {
                                t('place.form.unscheduled')
                            }
                        </button>
                        {
                            form.visit_date && (
                                <label>
                                    {
                                        t('section.label')
                                    }
                                    <select
                                        aria-label={ t('section.label') }
                                        value={ form.section_id ?? '' }
                                        onChange={ (e) =>
                                            setForm({
                                                ...form,
                                                section_id: e.target.value
                                                    ? Number(e.target.value)
                                                    : null,
                                            })
                                        }
                                    >
                                        <option value="">
                                            {
                                                defaultSectionNames[form.visit_date] ??
                                                t('section.defaultName')
                                            }
                                        </option>
                                        {
                                            sections
                                                .filter((s) => s.visit_date === form.visit_date)
                                                .map((s) => (
                                                    <option
                                                        key={ s.id }
                                                        value={ s.id }
                                                    >
                                                        {
                                                            s.name
                                                        }
                                                    </option>
                                                ))
                                        }
                                    </select>
                                </label>
                            )
                        }
                        <label>
                            {
                                t('place.form.requiredOrder')
                            }
                            <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                value={ form.required_order }
                                placeholder={ t('place.form.automaticOrder') }
                                onChange={ (e) =>
                                    setForm({ ...form, required_order: e.target.value })
                                }
                            />
                        </label>
                        <p className="small muted">
                            {
                                t('place.form.requiredOrderHint')
                            }
                        </p>
                        {
                            form.required_order && (
                                <button
                                    type="button"
                                    className="text-button"
                                    onClick={ () => setForm({ ...form, required_order: '' }) }
                                >
                                    {
                                        t('place.form.clearRequiredOrder')
                                    }
                                </button>
                            )
                        }
                        <label>
                            {
                                t('place.form.requiredTime')
                            }
                            <input
                                type="time"
                                value={ form.required_time }
                                onChange={ (e) =>
                                    setForm({ ...form, required_time: e.target.value })
                                }
                            />
                        </label>
                        <p className="small muted">
                            {
                                t('place.form.requiredTimeHint')
                            }
                        </p>
                        {
                            form.required_time && (
                                <button
                                    type="button"
                                    className="text-button"
                                    onClick={ () => setForm({ ...form, required_time: '' }) }
                                >
                                    {
                                        t('place.form.clearRequiredTime')
                                    }
                                </button>
                            )
                        }
                    </form>
                </div>
                <footer className="modal-footer">
                    {
                        error && (
                            <p
                                role="alert"
                                className="error"
                            >
                                {
                                    translateMessage(error)
                                }
                            </p>
                        )
                    }
                    <Button
                        type="submit"
                        form={ formId }
                        className="full"
                        disabled={ busy || !form.name.trim() }
                    >
                        <Plus size={ 16 } />
                        {
                            busy
                                ? t('common.status.working')
                                : place
                                    ? t('common.button.saveChanges')
                                    : t('place.form.save')
                        }
                    </Button>
                </footer>
            </section>
        </div>
    );
}
