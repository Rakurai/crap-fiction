import { participantMarkTreatment } from './participantMark.js'

export type SurfaceMeasures = Readonly<{
  prose: string
  transcript: number
  identityGutter: number
  sayMore: number
  sideOverlay: number
  listDetailOverlay: number
  centredOverlayHeight: number
  handlePicker: number
  modelChoice: number
  workspaceGate: number
}>

declare module '@mui/material/styles' {
  interface Theme {
    measures: SurfaceMeasures
  }

  interface ThemeOptions {
    measures?: SurfaceMeasures
  }
}

export const surfaceMeasures: SurfaceMeasures = {
  prose: '68ch',
  transcript: 480,
  identityGutter: participantMarkTreatment.diameter,
  sayMore: 160,
  sideOverlay: 360,
  listDetailOverlay: 640,
  centredOverlayHeight: 240,
  handlePicker: 280,
  modelChoice: 224,
  workspaceGate: 480,
}
