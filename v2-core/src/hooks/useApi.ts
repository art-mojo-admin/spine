import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastFetched: Date | null
}

interface UseApiOptions<T> {
  immediate?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
  initialData?: T
}

interface UseApiReturn<T> {
  data: T | null
  loading: boolean
  error: string | null
  execute: (params?: any) => Promise<T>
  reset: () => void
  refetch: () => Promise<T>
}

export function useApi<T>(
  apiFunction: (params?: any) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const { immediate = false, onSuccess, onError, initialData = null } = options
  const location = useLocation()
  
  const apiFunctionRef = useRef(apiFunction)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  const immediateRef = useRef(immediate)
  const initialDataRef = useRef(initialData)
  
  apiFunctionRef.current = apiFunction
  onSuccessRef.current = onSuccess
  onErrorRef.current = onError
  immediateRef.current = immediate
  initialDataRef.current = initialData

  const [state, setState] = useState<ApiState<T>>({
    data: initialData,
    loading: false,
    error: null,
    lastFetched: null
  })

  // Stable AbortController ref — replaced on each new fetch cycle
  const abortControllerRef = useRef<AbortController | null>(null)

  const execute = useCallback(async (params?: any) => {
    // Create a new AbortController for this specific request
    const abortController = new AbortController()
    const { signal } = abortController
    
    // Cancel previous request if still running
    abortControllerRef.current?.abort()
    abortControllerRef.current = abortController

    console.log('useApi execute: starting request', { signalAborted: signal.aborted })
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await apiFunctionRef.current({ ...params, signal })
      console.log('useApi execute: request completed', { signalAborted: signal.aborted, result })
      if (signal.aborted) {
        console.log('useApi execute: request was aborted, returning result')
        return result
      }
      setState({
        data: result,
        loading: false,
        error: null,
        lastFetched: new Date()
      })
      onSuccessRef.current?.(result)
      return result
    } catch (error: any) {
      console.log('useApi execute: request failed', { error, signalAborted: signal.aborted, errorName: error?.name })
      if ((error as any)?.name === 'AbortError') {
        console.log('useApi execute: abort error, throwing')
        throw error
      }
      const errorMessage = error?.message || 'An error occurred'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      onErrorRef.current?.(errorMessage)
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    setState({
      data: initialDataRef.current,
      loading: false,
      error: null,
      lastFetched: null
    })
  }, [])

  const refetch = useCallback(() => {
    return execute()
  }, [execute])

  // Re-fetch when pathname changes (navigation) — AbortController cancels
  // any previous in-flight request so auth state re-renders don't corrupt data
  useEffect(() => {
    if (!immediateRef.current) return
    setState({
      data: initialDataRef.current,
      loading: false,
      error: null,
      lastFetched: null
    })
    const timeoutId = setTimeout(() => { execute() }, 0)
    return () => {
      clearTimeout(timeoutId)
      abortControllerRef.current?.abort()
    }
  }, [location.pathname, execute])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    reset,
    refetch
  }
}

interface PaginatedApiState<T> extends ApiState<T[]> {
  pagination: {
    page: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
  }
}

interface UsePaginatedApiOptions<T> extends UseApiOptions<T[]> {
  itemsPerPage?: number
}

interface UsePaginatedApiReturn<T> extends UseApiReturn<T[]> {
  pagination: PaginatedApiState<T>['pagination']
  setPage: (page: number) => void
  setItemsPerPage: (itemsPerPage: number) => void
  nextPage: () => void
  prevPage: () => void
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function usePaginatedApi<T>(
  apiFunction: (params: { page: number; itemsPerPage: number; [key: string]: any }) => Promise<{
    data: T[]
    pagination: {
      page: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
    }
  }>,
  options: UsePaginatedApiOptions<T> = {}
): UsePaginatedApiReturn<T> {
  const { itemsPerPage: defaultItemsPerPage = 20, ...apiOptions } = options
  
  const [state, setState] = useState<PaginatedApiState<T>>({
    data: [],
    loading: false,
    error: null,
    lastFetched: null,
    pagination: {
      page: 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: defaultItemsPerPage
    }
  })

  const execute = useCallback(async (params?: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await apiFunction({
        page: state.pagination.page,
        itemsPerPage: state.pagination.itemsPerPage,
        ...params
      })
      
      setState({
        data: result.data,
        loading: false,
        error: null,
        lastFetched: new Date(),
        pagination: result.pagination
      })
      
      apiOptions.onSuccess?.(result.data)
      return result.data
    } catch (error: any) {
      const errorMessage = error?.message || 'An error occurred'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      apiOptions.onError?.(errorMessage)
      throw error
    }
  }, [apiFunction, state.pagination.page, state.pagination.itemsPerPage, apiOptions])

  const setPage = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        page
      }
    }))
  }, [])

  const setItemsPerPage = useCallback((itemsPerPage: number) => {
    setState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        itemsPerPage,
        page: 1 // Reset to first page when changing items per page
      }
    }))
  }, [])

  const nextPage = useCallback(() => {
    if (state.pagination.page < state.pagination.totalPages) {
      setPage(state.pagination.page + 1)
    }
  }, [state.pagination.page, state.pagination.totalPages, setPage])

  const prevPage = useCallback(() => {
    if (state.pagination.page > 1) {
      setPage(state.pagination.page - 1)
    }
  }, [state.pagination.page, setPage])

  const reset = useCallback(() => {
    setState({
      data: [],
      loading: false,
      error: null,
      lastFetched: null,
      pagination: {
        page: 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: defaultItemsPerPage
      }
    })
  }, [defaultItemsPerPage])

  const refetch = useCallback(() => {
    return execute()
  }, [execute])

  const hasNextPage = state.pagination.page < state.pagination.totalPages
  const hasPrevPage = state.pagination.page > 1

  // Auto-execute when page or itemsPerPage changes
  useEffect(() => {
    if (apiOptions.immediate) {
      execute()
    }
  }, [state.pagination.page, state.pagination.itemsPerPage, apiOptions.immediate, execute])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    reset,
    refetch,
    pagination: state.pagination,
    setPage,
    setItemsPerPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage
  }
}

interface MutationState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseMutationOptions<T, P> {
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
  onSettled?: () => void
}

interface UseMutationReturn<T, P> {
  data: T | null
  loading: boolean
  error: string | null
  mutate: (params: P) => Promise<T>
  reset: () => void
}

export function useMutation<T, P = void>(
  mutationFunction: (params: P) => Promise<T>,
  options: UseMutationOptions<T, P> = {}
): UseMutationReturn<T, P> {
  const { onSuccess, onError, onSettled } = options
  
  const [state, setState] = useState<MutationState<T>>({
    data: null,
    loading: false,
    error: null
  })

  const mutate = useCallback(async (params: P) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await mutationFunction(params)
      setState({
        data: result,
        loading: false,
        error: null
      })
      onSuccess?.(result)
      return result
    } catch (error: any) {
      const errorMessage = error?.message || 'An error occurred'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      onError?.(errorMessage)
      throw error
    } finally {
      onSettled?.()
    }
  }, [mutationFunction, onSuccess, onError, onSettled])

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null
    })
  }, [])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    mutate,
    reset
  }
}
