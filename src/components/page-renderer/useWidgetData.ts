import { useEffect, useState, useRef } from 'react'
import { apiPost } from '@/lib/api'
import type { DataSourceConfig } from '@/lib/widgetRegistry'

export interface WidgetDataRow {
  group: string
  value: number
  count: number
}

export interface WidgetDataResult {
  rows: WidgetDataRow[]
  total: number
  layers?: { label: string; rows: WidgetDataRow[]; total: number }[]
}

export function useWidgetData(dataSource: DataSourceConfig | undefined) {
  const [data, setData] = useState<WidgetDataResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configRef = useRef<string>('')

  useEffect(() => {
    if (!dataSource?.entity) {
      setData(null)
      return
    }

    const configKey = JSON.stringify(dataSource)
    if (configKey === configRef.current) return
    configRef.current = configKey

    setLoading(true)
    setError(null)

    apiPost<WidgetDataResult>('widget-data', dataSource)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load data')
        setData(null)
      })
      .finally(() => setLoading(false))
  }, [JSON.stringify(dataSource)])

  return { data, loading, error }
}
