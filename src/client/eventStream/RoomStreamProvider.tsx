import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { SurfaceId } from '../../shared/surfaces.js'
import { connectToRoom, type RoomConnection } from './roomConnection.js'
import type { ConnectionStatus, ScopeActivity } from './roomProjection.js'

const RoomStreamContext = createContext<RoomConnection | null>(null)

export type RoomStreamProviderProps = Readonly<{ pieceId: string | null; children: ReactNode }>

export function RoomStreamProvider({ pieceId, children }: RoomStreamProviderProps) {
  const queryClient = useQueryClient()
  const [connection, setConnection] = useState<RoomConnection | null>(null)

  useEffect(() => {
    if (pieceId === null) {
      setConnection(null)
      return
    }
    const created = connectToRoom(pieceId, queryClient)
    setConnection(created)
    return () => created.dispose()
  }, [pieceId, queryClient])

  return <RoomStreamContext.Provider value={connection}>{children}</RoomStreamContext.Provider>
}

function neverSubscribe(): () => void {
  return () => {}
}

const UNKNOWN_ACTIVITY: ScopeActivity = { status: 'unknown' }
const RETRYING_CONNECTION: ConnectionStatus = { status: 'retrying' }

export function useScopeActivity(surface: SurfaceId): ScopeActivity {
  const connection = useContext(RoomStreamContext)
  return useSyncExternalStore(
    connection?.subscribe ?? neverSubscribe,
    () => connection?.getState().scopes[surface] ?? UNKNOWN_ACTIVITY,
  )
}

export function useRoomConnectionStatus(): ConnectionStatus {
  const connection = useContext(RoomStreamContext)
  return useSyncExternalStore(connection?.subscribe ?? neverSubscribe, () => connection?.getState().connection ?? RETRYING_CONNECTION)
}

export function useSurfaceEditable(surface: SurfaceId): boolean {
  const activity = useScopeActivity(surface)
  return !(activity.status === 'busy' && activity.action.kind === 'apply')
}
