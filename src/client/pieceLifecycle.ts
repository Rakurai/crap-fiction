export type LifecycleProps = Readonly<{
  retitling: boolean
  retitleError: string | undefined
  onRetitle: (title: string) => void
}>
