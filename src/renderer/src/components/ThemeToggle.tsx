import type { ComponentType, SVGProps } from 'react'
import { useI18n } from '../i18n'
import type { TranslationKey } from '../lib/i18n'
import type { ThemePreference } from '../lib/theme'
import { useTheme } from '../theme'
import { MonitorIcon, MoonIcon, SunIcon } from './icons'

const choices: {
  value: ThemePreference
  labelKey: TranslationKey
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  { value: 'system', labelKey: 'theme.system', Icon: MonitorIcon },
  { value: 'light', labelKey: 'theme.light', Icon: SunIcon },
  { value: 'dark', labelKey: 'theme.dark', Icon: MoonIcon }
]

export function ThemeToggle() {
  const { t } = useI18n()
  const { preference, setPreference } = useTheme()

  return (
    <div className="segmented theme-toggle" role="group" aria-label={t('theme.label')}>
      {choices.map(({ value, labelKey, Icon }) => (
        <button
          key={value}
          className={preference === value ? 'active' : ''}
          type="button"
          aria-pressed={preference === value}
          aria-label={t(labelKey)}
          title={t(labelKey)}
          onClick={() => setPreference(value)}
        >
          <Icon width={15} height={15} />
        </button>
      ))}
    </div>
  )
}
