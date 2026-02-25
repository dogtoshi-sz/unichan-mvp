import type { WxtViteConfig } from 'wxt'

import UnoCSS from 'unocss/vite'

import { defineConfig } from 'wxt'

type VitePlugin = NonNullable<WxtViteConfig['plugins']>[number]

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Unichan – Screen context for Tamagotchi',
    description: 'Sends browser context (page, video, subtitles) to desktop Tamagotchi. No character on the page.',
    permissions: ['storage', 'tabs'],
    host_permissions: [
      'http://localhost/*',
      'http://127.0.0.1/*',
      'https://*/*',
      'http://*/*',
    ],
    web_accessible_resources: [
      { resources: ['chunks/*', 'assets/*'], matches: ['<all_urls>'] },
    ],
    action: {
      default_title: 'Unichan – Screen context',
    },
  },
  vite: () => {
    return {
      plugins: [
        UnoCSS() as VitePlugin,
      ],
    }
  },
})
