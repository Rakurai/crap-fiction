/** The piece-wide controls every surface's chrome draws identically. */
export type LifecycleProps = Readonly<{
  retitling: boolean
  retitleError: string | undefined
  onRetitle: (title: string) => void
}>
