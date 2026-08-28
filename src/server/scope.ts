import type { PieceSurfaceId, SurfaceId } from '../shared/surfaces.js'

export type RoomScope = Readonly<{ pieceId: string; surface: SurfaceId }>

export type ConversationScope =
  | Readonly<{ kind: 'piece'; workspaceDir: string; pieceId: string; surface: PieceSurfaceId }>
  | Readonly<{ kind: 'global' }>

export function conversationScopeFor(workspaceDir: string, room: RoomScope): ConversationScope {
  return room.surface === 'authorContext' ? { kind: 'global' } : { kind: 'piece', workspaceDir, pieceId: room.pieceId, surface: room.surface }
}

const KEY_SEPARATOR = '\u0000'

export function roomScopeKey(scope: RoomScope): string {
  return `${scope.pieceId}${KEY_SEPARATOR}${scope.surface}`
}
