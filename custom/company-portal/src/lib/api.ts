import { api as coreApi, ApiError } from '@/lib/api'

const norm = (ep: string) => ep.replace(/^\/custom\//, '')

export const api = coreApi
export const apiGet = <T = any>(ep: string, params?: Record<string, string>) => coreApi<T>(norm(ep), { params })
export const apiPost = <T = any>(ep: string, body: unknown) => coreApi<T>(norm(ep), { method: 'POST', body })
export const apiPatch = <T = any>(ep: string, body: unknown, params?: Record<string, string>) => coreApi<T>(norm(ep), { method: 'PATCH', body, params })
export const apiDelete = <T = any>(ep: string, params?: Record<string, string>) => coreApi<T>(norm(ep), { method: 'DELETE', params })
export { ApiError }
