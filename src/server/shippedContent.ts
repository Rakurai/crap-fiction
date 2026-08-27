import path from 'node:path'
import type { SurfaceId } from '../shared/surfaces.js'
import { callSites, type CallSiteDescriptor } from './model/callSites.js'
import { loadCharter, type Charter } from './model/charter.js'
import { loadPromptFragments, type PromptFragments } from './model/prompts.js'
import { loadRoles, type RoleDefinition } from './model/roles.js'
import { loadModes, type ModeDescriptor } from './modes.js'
import { defaultCastFor, resolveRoster, specialistsFor, type RoomRoster } from './room/roster.js'
import { readShippedAuthorContextReference } from './store/index.js'

export const CONTENT_ROOT = path.join(import.meta.dirname, '..', '..', 'content')

export class UnknownModeError extends Error {
  constructor(modeId: string) {
    super(`no loaded mode "${modeId}"`)
    this.name = 'UnknownModeError'
  }
}

/** The parsed, not-yet-related shape shipped content boils down to, however it was obtained. */
export type ShippedContentParts = Readonly<{
  modes: readonly ModeDescriptor[]
  roles: readonly RoleDefinition[]
  charter: Charter
  fragments: PromptFragments
  authorContextReference: string
}>

/**
 * The one owner of the relationships among modes, participants, prompt material and model call
 * sites: the studio's whole shipped-content package, loaded and validated once, then held
 * immutable for every domain question a consumer asks of it. Bootstrap, piece creation and
 * opening, and room operation all ask this catalog rather than reconstructing mode lookup,
 * roster derivation or reference selection for themselves.
 */
export class ShippedContentCatalog {
  readonly #modes: ReadonlyMap<string, ModeDescriptor>
  readonly #roster: RoomRoster
  readonly #charter: Charter
  readonly #fragments: PromptFragments
  readonly #sites: readonly CallSiteDescriptor[]
  readonly #authorContextReference: string
  readonly #displayNames: ReadonlyMap<string, string>

  private constructor(parts: ShippedContentParts) {
    this.#modes = new Map(parts.modes.map((mode) => [mode.id, mode]))
    this.#roster = resolveRoster(parts.roles)
    this.#charter = parts.charter
    this.#fragments = parts.fragments
    this.#sites = callSites(parts.roles)
    this.#authorContextReference = parts.authorContextReference
    this.#displayNames = new Map(
      [...this.#roster.specialists, this.#roster.storyEditor, ...this.#roster.addressedOnly].map((role) => [role.id, role.displayName]),
    )
  }

  /** Loads and validates the complete shipped-content package rooted at `contentRoot`. */
  static load(contentRoot: string): ShippedContentCatalog {
    const modes = loadModes(contentRoot)
    const roles = loadRoles(contentRoot, new Set(modes.map((mode) => mode.id)))
    const charter = loadCharter(contentRoot)
    const fragments = loadPromptFragments(contentRoot)
    const authorContextReference = readShippedAuthorContextReference(contentRoot)
    return new ShippedContentCatalog({ modes, roles, charter, fragments, authorContextReference })
  }

  /** Assembles a catalog from already-parsed parts, for fixtures that state shipped content in memory rather than on disk. */
  static assemble(parts: ShippedContentParts): ShippedContentCatalog {
    return new ShippedContentCatalog(parts)
  }

  get modes(): readonly ModeDescriptor[] {
    return [...this.#modes.values()]
  }

  mode(id: string): ModeDescriptor {
    const mode = this.#modes.get(id)
    if (mode === undefined) throw new UnknownModeError(id)
    return mode
  }

  get roster(): RoomRoster {
    return this.#roster
  }

  get callSites(): readonly CallSiteDescriptor[] {
    return this.#sites
  }

  get charter(): Charter {
    return this.#charter
  }

  get fragments(): PromptFragments {
    return this.#fragments
  }

  /** Every cast, generalist and addressed-only participant's display name, by id. */
  get participantDisplayNames(): ReadonlyMap<string, string> {
    return this.#displayNames
  }

  get markOrdinals(): ReadonlyMap<string, number> {
    return this.#roster.markOrdinals
  }

  specialistsFor(modeId: string, surface: SurfaceId): readonly RoleDefinition[] {
    return specialistsFor(this.#roster.specialists, modeId, surface)
  }

  defaultCastFor(modeId: string, surface: SurfaceId): readonly string[] {
    return defaultCastFor(this.#roster.specialists, modeId, surface)
  }

  /** The reference guidance for a mode and surface: none for the draft, the mode's own for story context, the one global reference for author context. */
  referenceFor(modeId: string, surface: SurfaceId): string | null {
    if (surface === 'draft') return null
    if (surface === 'authorContext') return this.#authorContextReference
    return this.mode(modeId).storyContextReference
  }
}
