import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const baseProps: IconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
}

export function TapeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="8.5" cy="11" r="2.25" />
      <circle cx="15.5" cy="11" r="2.25" />
      <path d="M8.5 13.25h7M7 18l2-3h6l2 3" />
    </svg>
  )
}

export function PlugIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 22v-5" />
      <path d="M9 8V2M15 8V2" />
      <path d="M18 8v3a6 6 0 0 1-12 0V8h12Z" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
    </svg>
  )
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </svg>
  )
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

export function XIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function TimelineIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TopicTreeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="17" cy="9" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M6 7v8a3 3 0 0 0 3 3h6M8 9h7" />
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  )
}

export function MonitorIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  )
}

export function GithubIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 19c-4.5 1.4-4.5-2.3-6-2.8m12 5.8v-3.6a3 3 0 0 0-.9-2.4c2.9-.3 5.9-1.4 5.9-6.4a5 5 0 0 0-1.3-3.4 4.6 4.6 0 0 0-.1-3.4S17.5 2 15 3.7a13 13 0 0 0-6 0C6.5 2 5.4 2.8 5.4 2.8a4.6 4.6 0 0 0-.1 3.4A5 5 0 0 0 4 9.6c0 5 3 6.1 5.9 6.4a3 3 0 0 0-.9 2.4V22" />
    </svg>
  )
}

export function PaletteIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3a9 9 0 0 0 0 18 2.4 2.4 0 0 0 1.8-4 2.4 2.4 0 0 1 1.8-4H18a3 3 0 0 0 3-3 9 9 0 0 0-9-7Z" />
      <circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  )
}
