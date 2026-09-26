import { t, translateMessage } from '../../lib/i18n';
import { useTranslation } from 'react-i18next';
import { Car, Footprints, TrainFront, Map } from 'lucide-react';
import type { Mode } from '../../lib/types';
export function ModeSwitch({
    value,
    onChange,
    unavailable = {},
}: {
    value: Mode | 'MAP';
    unavailable?: Partial<Record<Mode | 'MAP', string>>;
    onChange: (mode: Mode | 'MAP') => void;
}) {
    useTranslation();
    return (
        <div
            className="mode-switch"
            aria-label={ t('route.mode.label') }
        >
            {
                (
                    [
                        ['MAP', 'Map', Map],
                        ['WALK', t('route.mode.walk'), Footprints],
                        ['DRIVE', t('route.mode.drive'), Car],
                        ['TRANSIT', t('route.mode.transit'), TrainFront],
                    ] as const
                ).map(([mode, label, Icon]) => (
                    <button
                        key={ mode }
                        aria-pressed={ value === mode }
                        title={ unavailable[mode] ? translateMessage(unavailable[mode]!) : undefined }
                        aria-disabled={ !!unavailable[mode] }
                        className={ `${value === mode ? 'active' : ''} ${unavailable[mode] ? 'unavailable' : ''}` }
                        onClick={ () => {
                            if (!unavailable[mode]) onChange(mode);
                        } }
                    >
                        <Icon size={ 16 } />
                        {
                            label
                        }
                    </button>
                ))
            }
        </div>
    );
}
