import { homedir, userInfo } from 'node:os'
import { join, resolve } from 'node:path'

import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import Vue from '@vitejs/plugin-vue'
import UnoCss from 'unocss/vite'
import Info from 'unplugin-info/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Yaml from 'unplugin-yaml/vite'
import Inspect from 'vite-plugin-inspect'
import VitePluginVueDevTools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'
import VueMacros from 'vue-macros/vite'

import { Download } from '@proj-airi/unplugin-fetch'
import { DownloadLive2DSDK } from '@proj-airi/unplugin-live2d-sdk'
import { templateCompilerOptions } from '@tresjs/core'
import { createLogger } from 'vite'
import { defineConfig } from 'electron-vite'

const rootDir = resolve(join(import.meta.dirname, '..'))

/** Redact username and home path from log messages (universal privacy). */
function createRedactingLogger() {
  const defaultLogger = createLogger()
  const home = homedir()
  const username = userInfo().username
  const redact = (msg: string): string => {
    if (!msg) return msg
    let s = msg
    if (home && s.includes(home)) s = s.split(home).join('~')
    if (username && username !== 'USER' && s.includes(username)) s = s.split(username).join('USER')
    return s
  }
  return {
    ...defaultLogger,
    info: (msg: string, opts?: { clear?: boolean }) => defaultLogger.info(redact(msg), opts),
    warn: (msg: string, opts?: { clear?: boolean }) => defaultLogger.warn(redact(msg), opts),
    warnOnce: (msg: string, opts?: { clear?: boolean }) => defaultLogger.warnOnce(redact(msg), opts),
    error: (msg: string, opts?: { clear?: boolean; error?: Error }) => defaultLogger.error(redact(msg), opts),
  }
}
const stageUIAssetsRoot = resolve(rootDir, 'packages', 'stage-ui', 'src', 'assets')
const sharedCacheDir = resolve(rootDir, '.cache')

export default defineConfig({
  main: {
    customLogger: createRedactingLogger(),
    plugins: [Info()],
    build: {
      rollupOptions: {
        external: ['electron', 'mkcert', 'electron-click-drag-plugin'],
      },
    },
  },
  preload: {
    customLogger: createRedactingLogger(),
    build: {
      lib: {
        entry: {
          'index': resolve(join(import.meta.dirname, 'src', 'preload', 'index.ts')),
          'beat-sync': resolve(join(import.meta.dirname, 'src', 'preload', 'beat-sync.ts')),
        },
      },
    },
    plugins: [],
  },
  renderer: {
    customLogger: createRedactingLogger(),
    // Thanks to [@Maqsyo](https://github.com/Maqsyo)
    // https://github.com/alex8088/electron-vite/issues/99#issuecomment-1862671727
    base: './',

    build: {
      rolldownOptions: {
        input: {
          'main': resolve(join(import.meta.dirname, 'src', 'renderer', 'index.html')),
          'beat-sync': resolve(join(import.meta.dirname, 'src', 'renderer', 'beat-sync.html')),
        },
      },
    },

    optimizeDeps: {
      exclude: [
        // Internal Packages
        '@proj-airi/stage-ui/*',
        '@proj-airi/drizzle-duckdb-wasm',
        '@proj-airi/drizzle-duckdb-wasm/*',
        '@proj-airi/electron-screen-capture',

        // Static Assets: Models, Images, etc.
        'src/renderer/public/assets/*',

        // Live2D SDK
        '@framework/live2dcubismframework',
        '@framework/math/cubismmatrix44',
        '@framework/type/csmvector',
        '@framework/math/cubismviewmatrix',
        '@framework/cubismdefaultparameterid',
        '@framework/cubismmodelsettingjson',
        '@framework/effect/cubismbreath',
        '@framework/effect/cubismeyeblink',
        '@framework/model/cubismusermodel',
        '@framework/motion/acubismmotion',
        '@framework/motion/cubismmotionqueuemanager',
        '@framework/type/csmmap',
        '@framework/utils/cubismdebug',
        '@framework/model/cubismmoc',
      ],
    },

    resolve: {
      alias: {
        '@proj-airi/server-sdk': resolve(rootDir, 'packages', 'server-sdk', 'src'),
        '@proj-airi/i18n': resolve(rootDir, 'packages', 'i18n', 'src'),
        '@proj-airi/stage-ui': resolve(rootDir, 'packages', 'stage-ui', 'src'),
        '@proj-airi/stage-pages': resolve(rootDir, 'packages', 'stage-pages', 'src'),
        '@proj-airi/stage-shared': resolve(rootDir, 'packages', 'stage-shared', 'src'),
        '@proj-airi/stage-layouts': resolve(rootDir, 'packages', 'stage-layouts', 'src'),
      },
    },

    server: {
      port: 5173,
      strictPort: false,
      warmup: {
        clientFiles: [
          `${resolve(rootDir, 'packages', 'stage-ui', 'src')}/*.vue`,
          `${resolve(rootDir, 'packages', 'stage-pages', 'src')}/*.vue`,
        ],
      },
    },

    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          inlineDynamicImports: false,
          sourcemap: false,
        },
      },
    },

    plugins: [
      Info(),

      {
        name: 'proj-airi:defines',
        config(ctx) {
          const define: Record<string, any> = {
            'import.meta.env.RUNTIME_ENVIRONMENT': '\'electron\'',
          }
          if (ctx.mode === 'development') {
            define['import.meta.env.URL_MODE'] = '\'server\''
          }
          if (ctx.mode === 'production') {
            define['import.meta.env.URL_MODE'] = '\'file\''
          }

          return { define }
        },
      },

      Inspect(),

      Yaml(),

      VueMacros({
        plugins: {
          vue: Vue({
            include: [/\.vue$/, /\.md$/],
            ...templateCompilerOptions,
          }),
          vueJsx: false,
        },
        betterDefine: false,
      }),

      VueRouter({
        dts: resolve(import.meta.dirname, 'src/renderer/typed-router.d.ts'),
        routesFolder: [
          {
            src: resolve(rootDir, 'packages', 'stage-pages', 'src', 'pages'),
            exclude: base => [
              ...base,
              '**/settings/system/general.vue',
            ],
          },
          resolve(import.meta.dirname, 'src', 'renderer', 'pages'),
        ],
        exclude: ['**/components/**'],
      }),

      VitePluginVueDevTools(),

      // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
      Layouts({
        layoutsDirs: [
          resolve(import.meta.dirname, 'src', 'renderer', 'layouts'),
          resolve(rootDir, 'packages', 'stage-layouts', 'src', 'layouts'),
        ],
        pagesDirs: [resolve(import.meta.dirname, 'src', 'renderer', 'pages')],
      }),

      UnoCss(),

      // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
      VueI18n({
        runtimeOnly: true,
        compositionOnly: true,
        fullInstall: true,
      }),

      DownloadLive2DSDK(),
      Download('https://dist.ayaka.moe/live2d-models/hiyori_free_zh.zip', 'hiyori_free_zh.zip', 'live2d/models', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir }),
      Download('https://dist.ayaka.moe/live2d-models/hiyori_pro_zh.zip', 'hiyori_pro_zh.zip', 'live2d/models', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir }),
      Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-A/AvatarSample_A.vrm', 'AvatarSample_A.vrm', 'vrm/models/AvatarSample-A', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir }),
      Download('https://dist.ayaka.moe/vrm-models/VRoid-Hub/AvatarSample-B/AvatarSample_B.vrm', 'AvatarSample_B.vrm', 'vrm/models/AvatarSample-B', { parentDir: stageUIAssetsRoot, cacheDir: sharedCacheDir }),
    ],
  },
})
