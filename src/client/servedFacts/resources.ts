import { skipToken, useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'
import { callSiteAssignmentViewSchema, type CallSiteAssignmentView } from '../../shared/callSiteViews.js'
import { modeSummarySchema, type ModeSummary } from '../../shared/modeViews.js'
import { pieceDetailSchema, pieceSummarySchema, type PieceDetail, type PieceSummary } from '../../shared/pieceViews.js'
import { runtimeStatusSchema, type RuntimeStatus } from '../../shared/runtimeStatus.js'
import { get, put, type RequestFailure } from './transport.js'

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
