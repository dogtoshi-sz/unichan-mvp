<script setup lang="ts">
import { defineInvoke, defineInvokeHandler } from '@moeru/eventa'
import { themeColorFromValue, useThemeColor } from '@proj-airi/stage-layouts/composables/theme-color'
import { ToasterRoot } from '@proj-airi/stage-ui/components'
import { useSharedAnalyticsStore } from '@proj-airi/stage-ui/stores/analytics'
import { useCharacterOrchestratorStore } from '@proj-airi/stage-ui/stores/character'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useModsServerChannelStore } from '@proj-airi/stage-ui/stores/mods/api/channel-server'
import { useContextBridgeStore } from '@proj-airi/stage-ui/stores/mods/api/context-bridge'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { usePerfTracerBridgeStore } from '@proj-airi/stage-ui/stores/perf-tracer-bridge'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { useTheme } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { toast, Toaster } from 'vue-sonner'

import ResizeHandler from './components/ResizeHandler.vue'

import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { electronGetWebSocketServerUrl, electronOpenSettings, electronStartTrackMousePosition, electronStartWebSocketServer, unichanConfigGet } from '../shared/eventa'
import { useElectronEventaContext, useElectronEventaInvoke } from './composables/electron-vueuse'

const { isDark: dark } = useTheme()
const i18n = useI18n()
const contextBridgeStore = useContextBridgeStore()
const displayModelsStore = useDisplayModelsStore()
const settingsStore = useSettings()
const { language, themeColorsHue, themeColorsHueDynamic } = storeToRefs(settingsStore)
const onboardingStore = useOnboardingStore()
const router = useRouter()
const route = useRoute()
const cardStore = useAiriCardStore()
const chatSessionStore = useChatSessionStore()
const serverChannelStore = useModsServerChannelStore()
const characterOrchestratorStore = useCharacterOrchestratorStore()
const analyticsStore = useSharedAnalyticsStore()
usePerfTracerBridgeStore()

watch(language, () => {
  i18n.locale.value = language.value
})

const { updateThemeColor } = useThemeColor(themeColorFromValue({ light: 'rgb(255 255 255)', dark: 'rgb(18 18 18)' }))
watch(dark, () => updateThemeColor(), { immediate: true })
watch(route, () => updateThemeColor(), { immediate: true })
onMounted(() => updateThemeColor())

const startWebSocketServer = useElectronEventaInvoke(electronStartWebSocketServer)
const getWebSocketServerUrl = useElectronEventaInvoke(electronGetWebSocketServerUrl)

onMounted(async () => {
  analyticsStore.initialize()
  cardStore.initialize()
  onboardingStore.initializeSetupCheck()

  await chatSessionStore.initialize()
  await displayModelsStore.loadDisplayModelsFromIndexedDB()
  await settingsStore.initializeStageModel()
  // Start server and get the actual URL (ws or wss) so the client always matches the server.
  const resolvedUrl = await startWebSocketServer({ websocketSecureEnabled: settingsStore.websocketSecureEnabled }) ?? await getWebSocketServerUrl()

  // Use resolved URL for local so protocol matches (ws vs wss). Don't overwrite if user set a remote URL.
  const currentUrl = (serverChannelStore.websocketUrl ?? '').trim()
  let isLocalUrl = !currentUrl
  if (currentUrl) {
    try {
      const u = new URL(currentUrl)
      isLocalUrl = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    }
    catch {
      isLocalUrl = true
    }
  }
  if (resolvedUrl && isLocalUrl)
    serverChannelStore.websocketUrl = resolvedUrl

  await serverChannelStore.initialize({ possibleEvents: ['ui:configure'] }).catch(err => console.error('Failed to initialize Mods Server Channel in App.vue:', err))
  await contextBridgeStore.initialize()
  characterOrchestratorStore.initialize()

  const getUnichanConfig = useElectronEventaInvoke(unichanConfigGet)
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  // Brain connection is used only when "OpenClaw" is selected (useOpenClaw). Otherwise chat uses the cloud/custom provider.
  // When OpenClaw is selected but URL isn't set yet (e.g. config not loaded), use default port so chat can try instead of blocking.
  const defaultGatewayPort = 18790
  providersStore.setBrainConnectionResolver(() => {
    if (!consciousnessStore.useOpenClaw) return null
    const baseUrl = (consciousnessStore.gatewayBaseUrl ?? '').trim()
    const url = baseUrl || `http://localhost:${defaultGatewayPort}/v1/`
    if (!baseUrl && typeof console !== 'undefined' && console.warn) {
      console.warn(`[OpenClaw] No gateway URL in settings; using default http://localhost:${defaultGatewayPort}/v1/. Set port in Settings → Unichan and Save if your brain uses a different port.`)
    }
    return { baseUrl: url, apiKey: (consciousnessStore.gatewayToken ?? '').trim() }
  })

  async function applyUnichanGatewayConfig() {
    const defaultPort = 18790
    try {
      const unichanConfig = await getUnichanConfig()
      const port = unichanConfig?.gateway?.port ?? defaultPort
      const baseUrlRaw = unichanConfig?.gateway?.baseUrl?.trim()
      const baseUrl = baseUrlRaw
        ? (baseUrlRaw.replace(/\/models\/?$/i, '').replace(/\/?$/, '') + '/').replace(/^https:\/\//i, 'http://')
        : `http://localhost:${port}/v1/`
      const token = String((unichanConfig?.gateway?.apiKey ?? '').trim())
      const sessionKey = (unichanConfig?.gateway?.sessionKey ?? '').trim()
      const model = (unichanConfig?.agents?.defaults?.model ?? 'openclaw:main').trim() || 'openclaw:main'
      consciousnessStore.setGatewayConfig(baseUrl, token, sessionKey)
      consciousnessStore.useOpenClaw = true
      consciousnessStore.activeProvider = 'openai-compatible'
      consciousnessStore.activeModel = model
      providersStore.markProviderAdded('openai-compatible')
      await providersStore.disposeProviderInstance('openai-compatible')
    }
    catch (e) {
      console.warn('Could not apply Unichan gateway config:', e)
      // Ensure chat can use the gateway: set default URL and force OpenClaw mode so activeProvider is set.
      consciousnessStore.setGatewayConfig(`http://localhost:${defaultPort}/v1/`, '')
      consciousnessStore.useOpenClaw = true
      consciousnessStore.activeProvider = 'openai-compatible'
      consciousnessStore.activeModel = 'openclaw:main'
      providersStore.markProviderAdded('openai-compatible')
      await providersStore.disposeProviderInstance('openai-compatible')
    }
  }
  await applyUnichanGatewayConfig()
  // Re-apply when this window is shown again (visibility/focus)
  const onShow = () => { applyUnichanGatewayConfig() }
  document.addEventListener('visibilitychange', onShow)
  window.addEventListener('focus', onShow)
  const ipc = (window as any).electron?.ipcRenderer

  /** Re-sync Pinia stores from localStorage so changes made in the Settings window are visible here. */
  function syncStoresFromLocalStorage() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('settings/')) {
          const newValue = localStorage.getItem(key)
          window.dispatchEvent(new StorageEvent('storage', { key, newValue, oldValue: null }))
        }
      }
    }
    catch (e) {
      console.warn('[Settings sync] Re-reading localStorage failed:', e)
    }
  }

  /** When Settings closes, re-sync localStorage and re-read Unichan config so main window has latest brain URL/token. */
  function onSettingsClosed() {
    syncStoresFromLocalStorage()
    void applyUnichanGatewayConfig()
  }

  /** When Unichan config is saved, main process sends resolved baseUrl/token so we set the brain connection immediately. */
  function onUnichanConfigSaved(_ev: unknown, payload?: { baseUrl?: string, token?: string }) {
    // Re-apply full config from file so URL, token, and model (e.g. openclaw) are in sync
    void applyUnichanGatewayConfig()
  }

  if (ipc?.on) {
    ipc.on('unichan-config-saved', onUnichanConfigSaved)
    ipc.on('settings-window-closed', onSettingsClosed)
  }
  window.addEventListener('focus', syncStoresFromLocalStorage)
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onShow)
    window.removeEventListener('focus', onShow)
    window.removeEventListener('focus', syncStoresFromLocalStorage)
    if (ipc?.removeListener) {
      ipc.removeListener('unichan-config-saved', onUnichanConfigSaved)
      ipc.removeListener('settings-window-closed', onSettingsClosed)
    }
  })

  const context = useElectronEventaContext()
  const startTrackingCursorPoint = defineInvoke(context.value, electronStartTrackMousePosition)
  await startTrackingCursorPoint()

  // Listen for open-settings IPC message from main process
  defineInvokeHandler(context.value, electronOpenSettings, () => router.push('/settings'))
})

watch(themeColorsHue, () => {
  document.documentElement.style.setProperty('--chromatic-hue', themeColorsHue.value.toString())
}, { immediate: true })

watch(themeColorsHueDynamic, () => {
  document.documentElement.classList.toggle('dynamic-hue', themeColorsHueDynamic.value)
}, { immediate: true })

onUnmounted(() => contextBridgeStore.dispose())
</script>

<template>
  <ToasterRoot @close="id => toast.dismiss(id)">
    <Toaster />
  </ToasterRoot>
  <ResizeHandler />
  <RouterView />
</template>

<style>
/* We need this to properly animate the CSS variable */
@property --chromatic-hue {
  syntax: '<number>';
  initial-value: 0;
  inherits: true;
}

@keyframes hue-anim {
  from {
    --chromatic-hue: 0;
  }
  to {
    --chromatic-hue: 360;
  }
}

.dynamic-hue {
  animation: hue-anim 10s linear infinite;
}
</style>
