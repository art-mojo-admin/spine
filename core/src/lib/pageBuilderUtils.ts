import type { PageConfig, WidgetConfig, TabsConfig, AccordionConfig } from '@/lib/widgetRegistry'

export type BuilderScope =
  | { kind: 'root' }
  | { kind: 'tabs'; widgetId: string; tabIndex: number }
  | { kind: 'accordion'; widgetId: string; itemIndex: number }

export type ContainerScope = Exclude<BuilderScope, { kind: 'root' }>

export const ROOT_SCOPE: BuilderScope = { kind: 'root' }

export function isContainerScope(scope: BuilderScope): scope is ContainerScope {
  return scope.kind === 'tabs' || scope.kind === 'accordion'
}

export function getWidgetsAtScope(config: PageConfig, scopeStack: BuilderScope[]): WidgetConfig[] {
  if (scopeStack.length === 0 || scopeStack[0].kind !== 'root') {
    throw new Error('Scope stack must start with root')
  }

  let widgets = config.widgets || []
  for (let i = 1; i < scopeStack.length; i += 1) {
    const scope = scopeStack[i]
    if (!isContainerScope(scope)) continue
    const container = widgets.find((w) => w.id === scope.widgetId)
    if (!container) return []

    if (scope.kind === 'tabs') {
      const tabs = container.tabs_config?.tabs || []
      const tab = tabs[scope.tabIndex]
      if (!tab) return []
      widgets = tab.widgets || []
    } else if (scope.kind === 'accordion') {
      const items = container.accordion_config?.items || []
      const item = items[scope.itemIndex]
      if (!item) return []
      widgets = item.widgets || []
    }
  }

  return widgets
}

export function updateConfigAtScope(
  config: PageConfig,
  scopeStack: BuilderScope[],
  updater: (widgets: WidgetConfig[]) => WidgetConfig[],
): PageConfig {
  if (scopeStack.length === 0 || scopeStack[0].kind !== 'root') {
    throw new Error('Scope stack must start with root')
  }

  if (scopeStack.length === 1) {
    return { ...config, widgets: updater(config.widgets || []) }
  }

  const scopes = scopeStack.slice(1).filter(isContainerScope)
  const widgets = applyToWidgets(config.widgets || [], scopes, updater)
  return { ...config, widgets }
}

function applyToWidgets(
  widgets: WidgetConfig[],
  scopes: ContainerScope[],
  updater: (widgets: WidgetConfig[]) => WidgetConfig[],
): WidgetConfig[] {
  if (scopes.length === 0) {
    return updater(widgets)
  }

  const [current, ...rest] = scopes

  return widgets.map((widget) => {
    if (widget.id !== current.widgetId) {
      return widget
    }

    if (current.kind === 'tabs') {
      const tabsConfig: TabsConfig = widget.tabs_config || { tabs: [] }
      const tabs = tabsConfig.tabs || []
      const targetTab = tabs[current.tabIndex]
      if (!targetTab) return widget

      const updatedWidgets = applyToWidgets(targetTab.widgets || [], rest, updater)
      const newTabs = tabs.map((tab, idx) =>
        idx === current.tabIndex ? { ...tab, widgets: updatedWidgets } : tab,
      )

      return {
        ...widget,
        tabs_config: {
          ...tabsConfig,
          tabs: newTabs,
        },
      }
    }

    const accordionConfig: AccordionConfig = widget.accordion_config || { items: [] }
    const items = accordionConfig.items || []
    const targetItem = items[current.itemIndex]
    if (!targetItem) return widget

    const updatedWidgets = applyToWidgets(targetItem.widgets || [], rest, updater)
    const newItems = items.map((item, idx) =>
      idx === current.itemIndex ? { ...item, widgets: updatedWidgets } : item,
    )

    return {
      ...widget,
      accordion_config: {
        ...accordionConfig,
        items: newItems,
      },
    }
  })
}

export function findWidgetDeep(config: PageConfig, widgetId: string): WidgetConfig | null {
  const search = (widgets: WidgetConfig[]): WidgetConfig | null => {
    for (const widget of widgets) {
      if (widget.id === widgetId) return widget

      if (widget.tabs_config?.tabs) {
        for (const tab of widget.tabs_config.tabs) {
          const result = search(tab.widgets || [])
          if (result) return result
        }
      }

      if (widget.accordion_config?.items) {
        for (const item of widget.accordion_config.items) {
          const result = search(item.widgets || [])
          if (result) return result
        }
      }
    }
    return null
  }

  return search(config.widgets || [])
}

export function updateWidgetDeep(
  config: PageConfig,
  widgetId: string,
  updater: (widget: WidgetConfig) => WidgetConfig,
): PageConfig {
  const [widgets, changed] = mapWidgets(config.widgets || [])
  if (!changed) return config
  return { ...config, widgets }

  function mapWidgets(widgetsList: WidgetConfig[]): [WidgetConfig[], boolean] {
    let localChanged = false

    const nextWidgets = widgetsList.map((widget) => {
      let updatedWidget = widget
      let widgetChanged = false

      if (widget.id === widgetId) {
        updatedWidget = updater(widget)
        widgetChanged = true
      }

      if (widget.tabs_config?.tabs) {
        let tabsChanged = false
        const newTabs = widget.tabs_config.tabs.map((tab) => {
          const [childWidgets, childChanged] = mapWidgets(tab.widgets || [])
          if (childChanged) {
            tabsChanged = true
            return { ...tab, widgets: childWidgets }
          }
          return tab
        })

        if (tabsChanged) {
          updatedWidget = {
            ...updatedWidget,
            tabs_config: {
              ...updatedWidget.tabs_config!,
              tabs: newTabs,
            },
          }
          widgetChanged = true
        }
      }

      if (widget.accordion_config?.items) {
        let itemsChanged = false
        const newItems = widget.accordion_config.items.map((item) => {
          const [childWidgets, childChanged] = mapWidgets(item.widgets || [])
          if (childChanged) {
            itemsChanged = true
            return { ...item, widgets: childWidgets }
          }
          return item
        })

        if (itemsChanged) {
          updatedWidget = {
            ...updatedWidget,
            accordion_config: {
              ...updatedWidget.accordion_config!,
              items: newItems,
            },
          }
          widgetChanged = true
        }
      }

      if (widgetChanged) localChanged = true
      return updatedWidget
    })

    return [nextWidgets, localChanged]
  }
}

export function normalizeScopeStack(config: PageConfig, scopeStack: BuilderScope[]): BuilderScope[] {
  if (scopeStack.length === 0 || scopeStack[0].kind !== 'root') {
    return [ROOT_SCOPE]
  }

  const normalized: BuilderScope[] = [ROOT_SCOPE]

  for (let i = 1; i < scopeStack.length; i += 1) {
    const scope = scopeStack[i]
    if (!isContainerScope(scope)) continue
    const parentWidgets = getWidgetsAtScope(config, normalized)
    const container = parentWidgets.find((w) => w.id === scope.widgetId)
    if (!container) break

    if (scope.kind === 'tabs') {
      const tabs = container.tabs_config?.tabs || []
      if (!tabs.length) break
      const clampedIndex = Math.min(scope.tabIndex, tabs.length - 1)
      normalized.push({ kind: 'tabs', widgetId: scope.widgetId, tabIndex: clampedIndex })
    } else {
      const items = container.accordion_config?.items || []
      if (!items.length) break
      const clampedIndex = Math.min(scope.itemIndex, items.length - 1)
      normalized.push({ kind: 'accordion', widgetId: scope.widgetId, itemIndex: clampedIndex })
    }
  }

  return normalized
}

export function widgetsContainId(widgets: WidgetConfig[], widgetId: string): boolean {
  return widgets.some((w) => w.id === widgetId)
}

export function findScopePathForWidget(config: PageConfig, widgetId: string): BuilderScope[] | null {
  const search = (widgets: WidgetConfig[], stack: BuilderScope[]): BuilderScope[] | null => {
    for (const widget of widgets) {
      if (widget.id === widgetId) {
        return stack
      }

      if (widget.tabs_config?.tabs) {
        for (let i = 0; i < widget.tabs_config.tabs.length; i += 1) {
          const tab = widget.tabs_config.tabs[i]
          const result = search(tab.widgets || [], [...stack, { kind: 'tabs', widgetId: widget.id, tabIndex: i }])
          if (result) return result
        }
      }

      if (widget.accordion_config?.items) {
        for (let i = 0; i < widget.accordion_config.items.length; i += 1) {
          const item = widget.accordion_config.items[i]
          const result = search(item.widgets || [], [...stack, { kind: 'accordion', widgetId: widget.id, itemIndex: i }])
          if (result) return result
        }
      }
    }
    return null
  }

  return search(config.widgets || [], [ROOT_SCOPE])
}
