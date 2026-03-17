import type { CSSProperties } from 'react'
import type { StyleConfig } from './widgetRegistry'

const PADDING_CLASS_MAP: Record<string, string> = {
  none: 'p-0',
  xs: 'p-2',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const RADIUS_CLASS_MAP: Record<string, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

export function getWidgetStyleProps(style?: StyleConfig) {
  const classNames: string[] = []
  const inlineStyle: CSSProperties = {}

  if (!style) {
    return { className: '', style: inlineStyle }
  }

  if (style.padding && PADDING_CLASS_MAP[style.padding]) {
    classNames.push(PADDING_CLASS_MAP[style.padding])
  }

  if (style.border_radius && RADIUS_CLASS_MAP[style.border_radius]) {
    classNames.push(RADIUS_CLASS_MAP[style.border_radius])
  }

  if (style.border) {
    classNames.push('border border-border shadow-sm')
  }

  if (style.bg_color) {
    inlineStyle.backgroundColor = style.bg_color
  }

  return {
    className: classNames.join(' '),
    style: inlineStyle,
  }
}
