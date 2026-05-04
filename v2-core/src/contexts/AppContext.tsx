import React, { createContext, useContext } from 'react'
import { AppRecord } from '../hooks/useApps'

interface AppContextType {
  app: AppRecord
}

const AppContext = createContext<AppContextType | undefined>(undefined)

/**
 * Returns the current app record from the nearest AppProvider.
 * Must be called inside an AppProvider (i.e., inside an app route).
 */
export function useCurrentApp(): AppRecord {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useCurrentApp must be used within an AppProvider')
  }
  return context.app
}

interface AppProviderProps {
  app: AppRecord
  children: React.ReactNode
}

/**
 * Provides the current app record to all descendants via useCurrentApp().
 */
export function AppProvider({ app, children }: AppProviderProps) {
  return (
    <AppContext.Provider value={{ app }}>
      {children}
    </AppContext.Provider>
  )
}
