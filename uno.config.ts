/**
 * Root UnoCSS config shared by TAMAGOTCHI, CHROME-EXTENSION, stage-ui, etc.
 */
import {
  defineConfig,
  mergeConfigs,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

const basePresets = [
  presetWind3(),
  presetAttributify(),
  presetTypography(),
  presetIcons({ scale: 1.2 }),
]

export function sharedUnoConfig() {
  return defineConfig({
    presets: [
      ...basePresets,
      presetWebFonts({
        fonts: {
          sans: 'DM Sans',
          serif: 'DM Serif Display',
          mono: 'DM Mono',
          quanlai: { name: 'cjkfonts AllSeto', provider: 'none' },
          departure: { name: 'Departure Mono', provider: 'none' },
          xiaolai: { name: 'Xiaolai SC', provider: 'none' },
        },
        timeouts: { warning: 5000, failure: 10000 },
      }),
    ],
    transformers: [transformerDirectives(), transformerVariantGroup()],
    safelist: 'prose prose-sm m-auto text-left'.split(' '),
  })
}

export function histoireUnoConfig() {
  return defineConfig({
    presets: [
      ...basePresets,
      presetWebFonts({
        fonts: { sans: 'DM Sans', serif: 'DM Serif Display', mono: 'DM Mono' },
        timeouts: { warning: 5000, failure: 10000 },
      }),
    ],
    transformers: [transformerDirectives(), transformerVariantGroup()],
  })
}

export function presetWebFontsFonts(provider: 'google' | 'none' = 'google') {
  return {
    sans: 'DM Sans',
    serif: 'DM Serif Display',
    mono: 'DM Mono',
    quanlai: { name: 'cjkfonts AllSeto', provider: 'none' as const },
    departure: { name: 'Departure Mono', provider: 'none' as const },
    xiaolai: { name: 'Xiaolai SC', provider: 'none' as const },
  }
}
