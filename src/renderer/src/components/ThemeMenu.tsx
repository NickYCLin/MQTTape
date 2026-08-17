import { Fragment, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import {
  SYSTEM_PREFERENCE,
  themeCatalog,
  type ColorScheme,
  type ThemePreference
} from '../lib/theme'
import { useTheme } from '../theme'
import { CheckIcon, PaletteIcon } from './icons'

const schemeOrder: ColorScheme[] = ['dark', 'light']

export function ThemeMenu() {
  const { t } = useI18n()
  const { preference, theme, setPreference } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const choose = (next: ThemePreference): void => {
    setPreference(next)
    setOpen(false)
  }

  const activeLabel = preference === SYSTEM_PREFERENCE
    ? t('theme.system')
    : t(`theme.name.${preference}`)

  return (
    <div className="theme-menu" ref={containerRef}>
      <button
        className="btn ghost sm"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('theme.label')}
        title={`${t('theme.label')} · ${activeLabel}`}
        onClick={() => setOpen((current) => !current)}
      >
        <PaletteIcon width={15} height={15} />
        <span>{activeLabel}</span>
      </button>

      {open && (
        <div className="theme-popover" role="menu" aria-label={t('theme.label')}>
          <button
            className="theme-option"
            type="button"
            role="menuitemradio"
            aria-checked={preference === SYSTEM_PREFERENCE}
            onClick={() => choose(SYSTEM_PREFERENCE)}
          >
            <span className="swatch" data-swatch="system" aria-hidden="true" />
            <span className="theme-option-text">
              <strong>{t('theme.system')}</strong>
              <small>{t('theme.systemHint', { theme: t(`theme.name.${theme}`) })}</small>
            </span>
            {preference === SYSTEM_PREFERENCE && <CheckIcon width={15} height={15} />}
          </button>

          {schemeOrder.map((scheme) => (
            <Fragment key={scheme}>
              <p className="theme-group">{t(scheme === 'dark' ? 'theme.dark' : 'theme.light')}</p>
              {themeCatalog
                .filter((entry) => entry.scheme === scheme)
                .map((entry) => (
                  <button
                    className="theme-option"
                    type="button"
                    role="menuitemradio"
                    aria-checked={preference === entry.id}
                    key={entry.id}
                    onClick={() => choose(entry.id)}
                  >
                    <span className="swatch" data-swatch={entry.id} aria-hidden="true" />
                    <span className="theme-option-text">
                      <strong>{t(`theme.name.${entry.id}`)}</strong>
                    </span>
                    {preference === entry.id && <CheckIcon width={15} height={15} />}
                  </button>
                ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
