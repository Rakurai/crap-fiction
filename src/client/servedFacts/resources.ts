import { skipToken, useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'
import { applyOutcomeSchema, type ApplyOutcome } from '../../shared/applyViews.js'
import { callSiteAssignmentViewSchema, type CallSiteAssignmentView } from '../../shared/callSiteViews.js'
import { entryConversationViewSchema, type EntryConversationView } from '../../shared/conversationEntryViews.js'
import { modeSummarySchema, type ModeSummary } from '../../shared/modeViews.js'
import { pieceDetailSchema, pieceSummarySchema, type PieceDetail, type PieceSummary } from '../../shared/pieceViews.js'
import { runtimeStatusSchema, type RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { DocumentSnapshot, SurfaceId } from '../../shared/surfaces.js'
import { get, post, put, type RequestFailure } from './transport.js'

const workspaceReadSchema = z.object({ workspace: z.string().nullable() })
const workspaceWriteSchema = z.object({ workspace: z.string() })

export const WORKSPACE_KEY = ['workspace'] as const

export function useWorkspace(): UseQueryResult<string | null, RequestFailure> {
  return useQuery({
    queryKey: WORKSPACE_KEY,
    queryFn: async ({ signal }) => (await get('/workspace', workspaceReadSchema, signal)).workspace,
    staleTime: Infinity,
  })
}

export function useSetWorkspace(): UseMutationResult<string, RequestFailure, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workspace: string) => (await put('/workspace', workspaceWriteSchema, { workspace })).workspace,
    onSuccess: (workspace) => queryClient.setQueryData(WORKSPACE_KEY, workspace),
  })
}

export const MODES_KEY = ['modes'] as const

export function useModes(): UseQueryResult<readonly ModeSummary[], RequestFailure> {
  return useQuery({
    queryKey: MODES_KEY,
    queryFn: ({ signal }) => get('/modes', z.array(modeSummarySchema).readonly(), signal),
    staleTime: Infinity,
  })
}

export const PIECES_KEY = ['pieces'] as const

export function usePieces(): UseQueryResult<readonly PieceSummary[], RequestFailure> {
  return useQuery({
    queryKey: PIECES_KEY,
    queryFn: ({ signal }) => get('/pieces', z.array(pieceSummarySchema).readonly(), signal),
  })
}

export const pieceDetailKey = (id: string | null) => ['piece', id] as const

export function usePieceDetail(id: string | null): UseQueryResult<PieceDetail, RequestFailure> {
  return useQuery({
    queryKey: pieceDetailKey(id),
    queryFn: id === null ? skipToken : ({ signal }) => get(`/pieces/${id}`, pieceDetailSchema, signal),
  })
}

export const CALL_SITES_KEY = ['callSites'] as const

export function useCallSites(): UseQueryResult<readonly CallSiteAssignmentView[], RequestFailure> {
  return useQuery({
    queryKey: CALL_SITES_KEY,
    queryFn: ({ signal }) => get('/call-sites', z.array(callSiteAssignmentViewSchema).readonly(), signal),
  })
}

export const MODELS_KEY = ['models'] as const

export function useModels(): UseQueryResult<RuntimeStatus, RequestFailure> {
  return useQuery({
    queryKey: MODELS_KEY,
    queryFn: ({ signal }) => get('/models', runtimeStatusSchema, signal),
  })
}

export const conversationKey = (pieceId: string, surface: SurfaceId, conversationId: string | null) =>
  ['conversation', pieceId, surface, conversationId] as const

export function useConversation(
  pieceId: string,
  surface: SurfaceId,
  conversationId: string | null,
): UseQueryResult<EntryConversationView, RequestFailure> {
  return useQuery({
    queryKey: conversationKey(pieceId, surface, conversationId),
    queryFn:
      conversationId === null
        ? skipToken
        : ({ signal }) => get(`/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}`, entryConversationViewSchema, signal),
  })
}

export type DispatchRequestBody =
  | Readonly<{ message: string; documents: DocumentSnapshot }>
  | Readonly<{ target: string; message: string; documents: DocumentSnapshot }>
  | Readonly<{ respondingTo: string; clarification?: string; documents: DocumentSnapshot }>

const dispatchResultSchema = z.object({ conversationId: z.string(), actionId: z.string() }).readonly()

export function useDispatch(
  pieceId: string,
  surface: SurfaceId,
  conversationId: string,
): UseMutationResult<{ conversationId: string; actionId: string }, RequestFailure, DispatchRequestBody> {
  return useMutation({
    mutationFn: (request) =>
      post(`/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}/dispatch`, dispatchResultSchema, request),
  })
}

export type ApplyRequestBody = Readonly<{ responseId: string; constraint?: string; documents: DocumentSnapshot }>

export function useApplyRecommendation(
  pieceId: string,
  surface: SurfaceId,
  conversationId: string,
): UseMutationResult<ApplyOutcome, RequestFailure, ApplyRequestBody> {
  return useMutation({
    mutationFn: (request) =>
      post(`/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}/apply`, applyOutcomeSchema, request),
  })
}

export function useAbandonAction(
  pieceId: string,
  surface: SurfaceId,
  conversationId: string,
): UseMutationResult<null, RequestFailure, string> {
  return useMutation({
    mutationFn: (actionId) =>
      post(`/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}/actions/${actionId}/abandon`, z.null(), null),
  })
}
