import { createContext, useContext } from 'react'
import type { WidgetConfig, PageConfig } from '@/lib/widgetRegistry'

export interface WidgetRendererEnv {
  renderWidget: (widget: WidgetConfig) => React.ReactNode
  layoutConfig: PageConfig['layout']
}

const WidgetRendererContext = createContext<WidgetRendererEnv | null>(null)

export function useWidgetRendererEnv(): WidgetRendererEnv {
  const ctx = useContext(WidgetRendererContext)
  if (!ctx) {
    throw new Error('WidgetRendererContext not provided')
  }
  return ctx
}

export default WidgetRendererContext
