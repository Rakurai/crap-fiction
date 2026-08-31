import { skipToken, useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'
import { applyConfirmationSchema, applyOutcomeSchema, type ApplyConfirmation, type ApplyOutcome } from '../../shared/applyViews.js'
import { callSiteAssignmentViewSchema, type CallSiteAssignmentView } from '../../shared/callSiteViews.js'
import { entryConversationViewSchema, type EntryConversationView } from '../../shared/conversationEntryViews.js'
import { modeSummarySchema, type ModeSummary } from '../../shared/modeViews.js'
import { pieceDetailSchema, pieceSummarySchema, type PieceDetail, type PieceSummary } from '../../shared/pieceViews.js'
import { runtimeStatusSchema, type RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { DocumentSnapshot, SurfaceId } from '../../shared/surfaces.js'
import { del, get, patch, post, put, type RequestFailure } from './transport.js'

const workspaceReadSchema = z.object({ workspace: z.string().nullable() })
const workspaceWriteSchema = z.object({ workspace: z.string() })

const WORKSPACE_KEY = ['workspace'] as const

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

const MODES_KEY = ['modes'] as const

export function useModes(): UseQueryResult<readonly ModeSummary[], RequestFailure> {
  return useQuery({
    queryKey: MODES_KEY,
    queryFn: ({ signal }) => get('/modes', z.array(modeSummarySchema).readonly(), signal),
    staleTime: Infinity,
  })
}

const PIECES_KEY = ['pieces'] as const

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

export function useCreatePiece(): UseMutationResult<PieceSummary, RequestFailure, Readonly<{ title: string; mode: string }>> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => post('/pieces', pieceSummarySchema, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PIECES_KEY }),
  })
}

type SetCastRequest = Readonly<{ surface: SurfaceId; ids: readonly string[] }>

export function useSetCast(pieceId: string): UseMutationResult<PieceDetail, RequestFailure, SetCastRequest> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (cast) => patch(`/pieces/${pieceId}`, pieceDetailSchema, { cast }),
    onSuccess: (detail) => queryClient.setQueryData(pieceDetailKey(pieceId), detail),
  })
}

const CALL_SITES_KEY = ['callSites'] as const

export function useCallSites(): UseQueryResult<readonly CallSiteAssignmentView[], RequestFailure> {
  return useQuery({
    queryKey: CALL_SITES_KEY,
    queryFn: ({ signal }) => get('/call-sites', z.array(callSiteAssignmentViewSchema).readonly(), signal),
  })
}

const assignmentWriteSchema = z.object({ site: z.string(), assignment: z.string() }).readonly()
type AssignmentWrite = z.infer<typeof assignmentWriteSchema>

export function useAssignModel(): UseMutationResult<AssignmentWrite, RequestFailure, Readonly<{ site: string; model: string }>> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ site, model }) => put(`/call-sites/${site}/assignment`, assignmentWriteSchema, { model }),
    onSuccess: ({ site, assignment }) => {
      queryClient.setQueryData<readonly CallSiteAssignmentView[]>(CALL_SITES_KEY, (current) =>
        current?.map((entry) => (entry.site === site ? { ...entry, assignment } : entry)),
      )
    },
  })
}

const MODELS_KEY = ['models'] as const

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

type DispatchRequestBody =
  | Readonly<{ message: string; documents: DocumentSnapshot }>
  | Readonly<{ target: string; message: string; documents: DocumentSnapshot }>
  | Readonly<{ respondingTo: string; clarification?: string; documents: DocumentSnapshot }>

export type DispatchResult = Readonly<{ conversationId: string; actionId: string }>

const dispatchResultSchema = z.object({ conversationId: z.string(), actionId: z.string() }).readonly()

export function dispatchTo(pieceId: string, surface: SurfaceId, conversationId: string, request: DispatchRequestBody): Promise<DispatchResult> {
  return post(`/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}/dispatch`, dispatchResultSchema, request)
}

export function useDispatch(pieceId: string, surface: SurfaceId, conversationId: string): UseMutationResult<DispatchResult, RequestFailure, DispatchRequestBody> {
  return useMutation({
    mutationFn: (request) => dispatchTo(pieceId, surface, conversationId, request),
  })
}

const mintedConversationSchema = z.object({ id: z.string() }).readonly()

export function mintConversation(pieceId: string, surface: SurfaceId): Promise<{ id: string }> {
  return post(`/pieces/${pieceId}/surfaces/${surface}/conversations`, mintedConversationSchema, null)
}

export function useDeleteConversation(pieceId: string, surface: SurfaceId): UseMutationResult<null, RequestFailure, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId) => del(`/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}`, z.null()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pieceDetailKey(pieceId) }),
  })
}

type ApplyRequestBody = Readonly<{ responseId: string; constraint?: string; documents: DocumentSnapshot }>

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

const pendingReplacementSchema = z.object({ replacement: z.string() }).readonly()

export function fetchPendingReplacement(pieceId: string, surface: SurfaceId, conversationId: string, applicationId: string): Promise<string> {
  return get(
    `/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}/apply/${applicationId}`,
    pendingReplacementSchema,
  ).then((body) => body.replacement)
}

export function confirmApply(pieceId: string, surface: SurfaceId, conversationId: string, applicationId: string): Promise<ApplyConfirmation> {
  return post(`/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}/apply/${applicationId}/confirm`, applyConfirmationSchema, null)
}

type AbandonRequest = Readonly<{ conversationId: string; actionId: string }>

export function useAbandonAction(pieceId: string, surface: SurfaceId): UseMutationResult<null, RequestFailure, AbandonRequest> {
  return useMutation({
    mutationFn: ({ conversationId, actionId }) =>
      post(`/pieces/${pieceId}/surfaces/${surface}/conversations/${conversationId}/actions/${actionId}/abandon`, z.null(), null),
  })
}
