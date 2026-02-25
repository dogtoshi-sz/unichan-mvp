import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { refManualReset } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useProvidersStore } from '../providers'

export const useConsciousnessStore = defineStore('consciousness', () => {
  const providersStore = useProvidersStore()

  // State
  const activeProvider = useLocalStorageManualReset<string>('settings/consciousness/active-provider', '')
  const activeModel = useLocalStorageManualReset<string>('settings/consciousness/active-model', '')
  const activeCustomModelName = useLocalStorageManualReset<string>('settings/consciousness/active-custom-model', '')
  const expandedDescriptions = refManualReset<Record<string, boolean>>(() => ({}))
  const modelSearchQuery = refManualReset<string>('')

  /** When true, chat uses OpenClaw (Unichan gateway). When false, chat uses the selected cloud/custom provider (OpenAI, OpenRouter, etc.). */
  const useOpenClaw = useLocalStorageManualReset<boolean>('settings/consciousness/use-openclaw', false)

  /** Brain/gateway connection when using Unichan remote brain. Used for chat requests (base URL + Bearer token). */
  const gatewayBaseUrl = refManualReset<string>('')
  const gatewayToken = refManualReset<string>('')
  /** OpenClaw session key so Tamagotchi uses the same gateway session as web chat/Telegram (X-OpenClaw-Session header). Defaults to agent:main:main. */
  const gatewaySessionKey = refManualReset<string>('')

  // Computed properties
  const supportsModelListing = computed(() => {
    return providersStore.getProviderMetadata(activeProvider.value)?.capabilities.listModels !== undefined
  })

  const providerModels = computed(() => {
    return providersStore.getModelsForProvider(activeProvider.value)
  })

  const isLoadingActiveProviderModels = computed(() => {
    return providersStore.isLoadingModels[activeProvider.value] || false
  })

  const activeProviderModelError = computed(() => {
    return providersStore.modelLoadError[activeProvider.value] || null
  })

  const filteredModels = computed(() => {
    if (!modelSearchQuery.value.trim()) {
      return providerModels.value
    }

    const query = modelSearchQuery.value.toLowerCase().trim()
    return providerModels.value.filter(model =>
      model.name.toLowerCase().includes(query)
      || model.id.toLowerCase().includes(query)
      || (model.description && model.description.toLowerCase().includes(query)),
    )
  })

  function resetModelSelection() {
    activeModel.reset()
    activeCustomModelName.reset()
    expandedDescriptions.reset()
    modelSearchQuery.reset()
  }

  async function loadModelsForProvider(provider: string) {
    if (provider && providersStore.getProviderMetadata(provider)?.capabilities.listModels !== undefined) {
      await providersStore.fetchModelsForProvider(provider)
    }
  }

  async function getModelsForProvider(provider: string) {
    if (provider && providersStore.getProviderMetadata(provider)?.capabilities.listModels !== undefined) {
      return providersStore.getModelsForProvider(provider)
    }

    return []
  }

  const configured = computed(() => {
    return !!activeProvider.value && !!activeModel.value
  })

  function resetState() {
    activeProvider.reset()
    resetModelSelection()
  }

  function setGatewayConfig(baseUrl: string, token: string, sessionKey?: string) {
    gatewayBaseUrl.value = (baseUrl ?? '').trim()
    gatewayToken.value = (token ?? '').trim()
    if (sessionKey !== undefined)
      gatewaySessionKey.value = (sessionKey ?? '').trim()
  }

  return {
    // State
    configured,
    useOpenClaw,
    activeProvider,
    activeModel,
    gatewayBaseUrl,
    gatewayToken,
    gatewaySessionKey,
    customModelName: activeCustomModelName,
    expandedDescriptions,
    modelSearchQuery,

    // Computed
    supportsModelListing,
    providerModels,
    isLoadingActiveProviderModels,
    activeProviderModelError,
    filteredModels,

    // Actions
    resetModelSelection,
    loadModelsForProvider,
    getModelsForProvider,
    resetState,
    setGatewayConfig,
  }
})
