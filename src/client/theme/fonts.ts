import publicSansVariable from '../fonts/public-sans-latin-variable.woff2'
import spectral300 from '../fonts/spectral-latin-300.woff2'
import spectral400 from '../fonts/spectral-latin-400.woff2'
import spectral500 from '../fonts/spectral-latin-500.woff2'
import spectral600 from '../fonts/spectral-latin-600.woff2'
import spectralItalic400 from '../fonts/spectral-latin-italic-400.woff2'

const PUBLIC_SANS = 'Public Sans'
const SPECTRAL = 'Spectral'

export const INTERFACE_FONT_STACK = `"${PUBLIC_SANS}", "Helvetica Neue", Arial, sans-serif`
export const PROSE_FONT_STACK = `"${SPECTRAL}", Georgia, "Times New Roman", serif`

function fontFace(family: string, weight: string, style: 'normal' | 'italic', src: string): string {
  return `
    @font-face {
      font-family: '${family}';
      font-style: ${style};
      font-display: swap;
      font-weight: ${weight};
      src: url(${src}) format('woff2');
    }
  `
}

export const fontFaceStyleOverrides = [
  fontFace(PUBLIC_SANS, '100 900', 'normal', publicSansVariable),
  fontFace(SPECTRAL, '300', 'normal', spectral300),
  fontFace(SPECTRAL, '400', 'normal', spectral400),
  fontFace(SPECTRAL, '500', 'normal', spectral500),
  fontFace(SPECTRAL, '600', 'normal', spectral600),
  fontFace(SPECTRAL, '400', 'italic', spectralItalic400),
].join('\n')
