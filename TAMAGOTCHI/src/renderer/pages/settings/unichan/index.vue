<script setup lang="ts">
import type { UnichanConfigPayload } from '../../../../shared/eventa'
import { Button, FieldCheckbox, FieldInput, FieldSelect, FieldTextArea } from '@proj-airi/ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { unichanConfigGet, unichanConfigSave, unichanTestGateway } from '../../../../shared/eventa'
import { useElectronEventaInvoke } from '../../../composables/electron-vueuse'

const { t } = useI18n()
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const getConfig = useElectronEventaInvoke(unichanConfigGet)
const saveConfig = useElectronEventaInvoke(unichanConfigSave)
const testGatewayInvoke = useElectronEventaInvoke(unichanTestGateway)

const providerOptions = [
  { value: 'openrouter', label: 'OpenRouter (GPT-4, Claude, etc.)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'groq', label: 'Groq' },
]

const activeProvider = ref('openrouter')
const providerKeys = ref<Record<string, string>>({})
const apiKey = computed({
  get: () => providerKeys.value[activeProvider.value] ?? '',
  set: (v: string) => { providerKeys.value[activeProvider.value] = v },
})
const model = ref('')
const personality = ref('')
const workspace = ref('')
const gatewayMode = ref<'same' | 'remote'>('same')
const gatewayPort = ref(18790)
const gatewayBaseUrl = ref('')
const gatewayToken = ref('')
const gatewaySessionKey = ref('')
const telegramEnabled = ref(false)
const telegramToken = ref('')
const telegramAllowFrom = ref('')
const saving = ref(false)
const saveMessage = ref('')
const testGatewayLoading = ref(false)
const testGatewayResult = ref('')

function deriveActiveProvider(
  modelStr: string,
  provs: Record<string, { apiKey?: string } | undefined>,
): string {
  // If model has a prefix (e.g. openai/gpt-4-turbo), use that provider when in our list
  if (modelStr?.includes('/')) {
    const p = modelStr.split('/')[0].toLowerCase()
    if (providerOptions.some(o => o.value === p))
      return p
  }
  // Infer from model name when no prefix: gpt -> openai, claude -> anthropic, etc.
  const lower = (modelStr ?? '').toLowerCase()
  if (lower.includes('gpt')) return 'openai'
  if (lower.includes('claude')) return 'anthropic'
  if (lower.includes('deepseek')) return 'deepseek'
  if (lower.includes('llama') || lower.includes('mixtral')) return 'groq'
  // Otherwise use the first provider that has an API key set
  const withKey = providerOptions.find(o => (provs[o.value] as { apiKey?: string } | undefined)?.apiKey?.trim())
  return withKey?.value ?? 'openrouter'
}

async function load() {
  const config = await getConfig()
  if (!config)
    return
  const agents = config.agents?.defaults
  model.value = agents?.model ?? 'openclaw:main'
  personality.value = agents?.personality ?? ''
  workspace.value = agents?.workspace ?? '~/.unichan/workspace'
  gatewayPort.value = config.gateway?.port ?? 18790
  const baseUrl = (config.gateway?.baseUrl ?? '').trim()
  if (!baseUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(baseUrl)) {
    gatewayMode.value = 'same'
    gatewayBaseUrl.value = ''
  } else {
    gatewayMode.value = 'remote'
    gatewayBaseUrl.value = baseUrl.replace(/^https:\/\//i, 'http://')
  }
  gatewayToken.value = config.gateway?.apiKey ?? ''
  gatewaySessionKey.value = config.gateway?.sessionKey ?? ''
  const provs = config.providers ?? {}
  providerKeys.value = Object.fromEntries(
    providerOptions.map(o => [o.value, (provs[o.value] as { apiKey?: string } | undefined)?.apiKey ?? '']),
  )
  activeProvider.value = deriveActiveProvider(model.value, provs)
  const tg = config.channels?.telegram
  telegramEnabled.value = tg?.enabled ?? false
  telegramToken.value = tg?.token ?? ''
  telegramAllowFrom.value = (tg?.allowFrom ?? []).join(', ')
  const resolved = resolvedGatewayBaseUrl.value
  if (resolved) {
    await applyGatewayToConsciousness(resolved, config.gateway?.apiKey ?? '', agents?.model, config.gateway?.sessionKey ?? '')
  }
}

/** Brain URL for remote mode: get/set so pasted or typed https:// is forced to http:// (gateway has no TLS). */
const gatewayBaseUrlSafe = computed({
  get: () => gatewayBaseUrl.value,
  set: (v: string) => { gatewayBaseUrl.value = (v || '').replace(/^https:\/\//i, 'http://') },
})

/** Resolved base URL for the brain: same machine = localhost:port, remote = normalized URL. Always HTTP for built-in gateway. */
const resolvedGatewayBaseUrl = computed(() => {
  if (gatewayMode.value === 'same') {
    const port = Number(gatewayPort.value) || 18790
    return `http://localhost:${port}/v1/`
  }
  const u = gatewayBaseUrl.value.trim()
  if (!u) return ''
  let normalized = normalizeGatewayBaseUrl(u)
  // Built-in unichan gateway is HTTP-only; force http so saved https URLs still work
  normalized = normalized.replace(/^https:\/\//i, 'http://')
  return normalized
})

function buildPayload(): UnichanConfigPayload {
  const allowFrom = telegramAllowFrom.value.split(',').map(s => s.trim()).filter(Boolean)
  const providers: Record<string, { apiKey?: string }> = {}
  for (const [key, val] of Object.entries(providerKeys.value)) {
    providers[key] = { apiKey: (val ?? '').trim() }
  }
  return {
    providers,
    agents: {
      defaults: {
        model: model.value.trim() || undefined,
        personality: personality.value.trim() || undefined,
        workspace: workspace.value.trim() || undefined,
      },
    },
    channels: {
      telegram: {
        enabled: telegramEnabled.value,
        token: telegramToken.value.trim() || undefined,
        allowFrom: allowFrom.length ? allowFrom : undefined,
      },
    },
    gateway: {
      port: gatewayPort.value,
      baseUrl: gatewayMode.value === 'remote' ? (resolvedGatewayBaseUrl.value || undefined) : undefined,
      apiKey: gatewayToken.value.trim(),
      sessionKey: gatewaySessionKey.value.trim() || undefined,
    },
  }
}

function normalizeGatewayBaseUrl(url: string): string {
  let u = url.trim()
  if (!u) return ''
  u = u.replace(/\/models\/?$/i, '')
  if (!u.endsWith('/')) u += '/'
  return u
}

/** Switch to local gateway on this machine. Clears remote URL and sets port to 18789 (unichan gateway default). */
function useThisComputer() {
  gatewayMode.value = 'same'
  gatewayBaseUrl.value = ''
  gatewayPort.value = 18790
}

async function applyGatewayToConsciousness(baseUrl: string, token: string, modelName?: string, sessionKey?: string) {
  if (!baseUrl.trim()) return
  const normalized = baseUrl.replace(/\/$/, '') + '/'
  consciousnessStore.setGatewayConfig(normalized, token.trim(), sessionKey ?? gatewaySessionKey.value.trim())
  consciousnessStore.activeProvider = 'openai-compatible'
  consciousnessStore.activeModel = (modelName ?? model.value ?? 'openclaw:main').trim() || 'openclaw:main'
  providersStore.markProviderAdded('openai-compatible')
  await providersStore.disposeProviderInstance('openai-compatible')
}

async function testGateway() {
  const baseUrl = resolvedGatewayBaseUrl.value
  if (!baseUrl) {
    testGatewayResult.value = gatewayMode.value === 'remote' ? 'Enter the brain URL first.' : 'Gateway port is required.'
    return
  }
  testGatewayLoading.value = true
  testGatewayResult.value = ''
  try {
    const result = await testGatewayInvoke({ baseUrl, token: gatewayToken.value.trim() })
    if (result?.ok) {
      testGatewayResult.value = result.message
      return
    }
    if (result?.status === 401 || result?.status === 403) {
      testGatewayResult.value = `${result.message}\n\nGet the correct token from the gateway dashboard (e.g. OpenClaw: Overview → Gateway Access → Gateway Token). It is sent as \`Authorization: Bearer <token>\`.`
      return
    }
    testGatewayResult.value = result?.message ?? 'Could not reach gateway.'
  }
  catch (e: any) {
    testGatewayResult.value = e?.message ?? String(e)
  }
  finally {
    testGatewayLoading.value = false
  }
}

async function save() {
  saving.value = true
  saveMessage.value = ''
  try {
    await saveConfig(buildPayload())
    const baseUrl = resolvedGatewayBaseUrl.value
    if (baseUrl) {
      await applyGatewayToConsciousness(baseUrl, gatewayToken.value.trim(), model.value, gatewaySessionKey.value.trim())
      consciousnessStore.useOpenClaw = true
      try {
        await providersStore.validateProvider('openai-compatible')
        await providersStore.fetchModelsForProvider('openai-compatible')
      }
      catch (e) {
        console.warn('Gateway unreachable when fetching models (brain may be offline). URL and token were still saved.', e)
      }
    }
    saveMessage.value = t('settings.pages.unichan.saved')
    setTimeout(() => { saveMessage.value = '' }, 3000)
  }
  catch (e) {
    saveMessage.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    saving.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <div class="rounded-lg bg-neutral-50 dark:bg-neutral-800 p-4 flex flex-col gap-5">
    <p class="text-neutral-600 dark:text-neutral-400 text-sm">
      {{ t('settings.pages.unichan.description') }}
    </p>
    <div class="rounded-lg border border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/15 p-3 text-sm">
      <p class="font-medium text-amber-800 dark:text-amber-200 mb-1">
        {{ t('settings.pages.unichan.gatewayRequiredTitle') }}
      </p>
      <p class="text-amber-800/90 dark:text-amber-200/90">
        {{ t('settings.pages.unichan.gatewayRequired') }}
      </p>
    </div>

    <div class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/15 p-3 text-sm">
      <p class="font-medium text-emerald-800 dark:text-emerald-200 mb-1">
        Required for chat (4 steps)
      </p>
      <p class="text-emerald-800/90 dark:text-emerald-200/90">
        1) <strong>Where is the brain running?</strong> → This computer. 2) <strong>Gateway port</strong> → 18790 (nanobot default). 3) <strong>Gateway token</strong> → Leave empty for nanobot; only needed for OpenClaw. 4) <strong>Model</strong> → <code>unichan</code>. Click Save, then in Settings → Consciousness select <strong>OpenClaw (Unichan brain)</strong>.
      </p>
    </div>

    <div class="rounded-lg border border-sky-500/40 bg-sky-500/10 dark:bg-sky-500/15 p-3 text-sm">
      <p class="font-medium text-sky-800 dark:text-sky-200 mb-1">
        OpenClaw: enable HTTP in config
      </p>
      <p class="text-sky-800/90 dark:text-sky-200/90">
        In <code>~/.openclaw/openclaw.json</code> add <code>gateway.http.endpoints.chatCompletions.enabled: true</code>, then restart <code>openclaw gateway</code>. <a href="https://docs.openclaw.ai/gateway/openai-http-api" target="_blank" rel="noopener" class="underline">Docs</a>
      </p>
    </div>

    <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 pt-1">
      Required for chat
    </p>
    <div class="flex flex-col gap-3">
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('settings.pages.unichan.brainLocation.label') }}
      </p>
      <div class="flex gap-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="gatewayMode"
            type="radio"
            value="same"
            class="rounded-full border-2 border-neutral-400 dark:border-neutral-500 focus:ring-2 focus:ring-primary-400/50 dark:focus:ring-primary-500/50"
          >
          <span class="text-sm">{{ t('settings.pages.unichan.brainLocation.sameMachine') }}</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="gatewayMode"
            type="radio"
            value="remote"
            class="rounded-full border-2 border-neutral-400 dark:border-neutral-500 focus:ring-2 focus:ring-primary-400/50 dark:focus:ring-primary-500/50"
          >
          <span class="text-sm">{{ t('settings.pages.unichan.brainLocation.remoteMachine') }}</span>
        </label>
      </div>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ gatewayMode === 'same' ? t('settings.pages.unichan.brainLocation.sameMachineHint') : t('settings.pages.unichan.brainLocation.remoteMachineHint') }}
      </p>
    </div>

    <template v-if="gatewayMode === 'same'">
      <FieldInput
        v-model.number="gatewayPort"
        type="number"
        :label="t('settings.pages.unichan.gatewayPort.label')"
        :description="t('settings.pages.unichan.gatewayPort.description')"
      />
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('settings.pages.unichan.brainLocation.sameMachineUrl', { url: resolvedGatewayBaseUrl || '' }) }}
      </p>
      <FieldInput
        v-model="gatewayToken"
        type="password"
        :label="t('settings.pages.unichan.gatewayToken.label')"
        :description="t('settings.pages.unichan.gatewayToken.descriptionSame')"
        :placeholder="t('settings.pages.unichan.gatewayToken.placeholder')"
      />
    </template>
    <template v-else>
      <div class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 flex flex-wrap items-center gap-2">
        <span class="text-sm text-amber-800 dark:text-amber-200">Using another machine. To use your local OpenClaw on this computer:</span>
        <button
          type="button"
          class="rounded-lg border-2 border-amber-400 dark:border-amber-600 bg-amber-100 dark:bg-amber-900/60 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800 focus:ring-2 focus:ring-amber-400/50 dark:focus:ring-amber-500/50 transition-colors"
          @click="useThisComputer"
        >
          Use this computer (localhost:18790)
        </button>
      </div>
      <FieldInput
        v-model="gatewayBaseUrlSafe"
        type="text"
        :label="t('settings.pages.unichan.gatewayUrl.label')"
        :description="t('settings.pages.unichan.gatewayUrl.description')"
        placeholder="e.g. http://192.168.1.100:18790/v1/"
      />
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('settings.pages.unichan.brainLocation.chatUsesUrl', { url: resolvedGatewayBaseUrl || '—' }) }}
      </p>
      <FieldInput
        v-model="gatewayToken"
        type="password"
        :label="t('settings.pages.unichan.gatewayToken.label')"
        :description="t('settings.pages.unichan.gatewayToken.description')"
        :placeholder="t('settings.pages.unichan.gatewayToken.placeholder')"
      />
    </template>

    <FieldInput
      v-model="model"
      :label="t('settings.pages.unichan.model.label')"
      :description="t('settings.pages.unichan.model.description')"
      placeholder="openclaw:main"
    />
    <FieldInput
      v-model="gatewaySessionKey"
      type="text"
      label="Session key"
      description="OpenClaw session identifier so the Tamagotchi shares the same conversation context. Default: agent:main:main. Sent as the X-OpenClaw-Session header."
      placeholder="agent:main:main"
    />

    <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 pt-2 border-t border-neutral-200 dark:border-neutral-600 mt-2">
      Optional (agent / CLI / Telegram)
    </p>
    <FieldSelect
      v-model="activeProvider"
      :label="t('settings.pages.unichan.provider.label')"
      :description="t('settings.pages.unichan.provider.description')"
      :options="providerOptions"
    />
    <FieldInput
      v-model="apiKey"
      type="password"
      :label="t('settings.pages.unichan.apiKey.label')"
      :description="t('settings.pages.unichan.apiKey.description')"
      :placeholder="t('settings.pages.unichan.apiKey.placeholder')"
    />
    <FieldTextArea
      v-model="personality"
      :label="t('settings.pages.unichan.personality.label')"
      :description="t('settings.pages.unichan.personality.description')"
      :placeholder="t('settings.pages.unichan.personality.placeholder')"
      rows="3"
    />
    <FieldInput
      v-model="workspace"
      :label="t('settings.pages.unichan.workspace.label')"
      :description="t('settings.pages.unichan.workspace.description')"
      placeholder="~/.unichan/workspace"
    />

    <div class="flex flex-col gap-2">
      <Button
        variant="secondary"
        size="md"
        :label="testGatewayLoading ? 'Testing…' : 'Test connection to brain'"
        :disabled="testGatewayLoading || (gatewayMode === 'remote' && !gatewayBaseUrl.trim())"
        :loading="testGatewayLoading"
        @click="testGateway()"
      />
      <p
        v-if="testGatewayResult"
        class="text-sm whitespace-pre-wrap rounded p-2"
        :class="testGatewayResult.startsWith('OK') ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'"
      >
        {{ testGatewayResult }}
      </p>
      <p v-if="testGatewayResult?.startsWith('OK')" class="text-xs text-neutral-600 dark:text-neutral-300 mt-2">
        Click <strong>Save</strong> below, then in <strong>Settings → Consciousness</strong> choose <strong>OpenClaw (Unichan brain)</strong>. You do not need to add or configure the OpenAI-compatible provider. For local, the token is optional — leave it empty.
      </p>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        Chat uses <strong>HTTP</strong> to the gateway URL above (e.g. <code>http://localhost:18789/v1/</code>). Console errors about <code>ws://localhost:6121/ws</code> refer to the internal channel (extension/sync), not the brain — you can ignore them for chat.
      </p>
      <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
        Tip: If chat still fails, open DevTools on the main character window (Ctrl+Shift+I or tray → Settings → open DevTools for main window). In the Network tab, send a message and find the request to your gateway — check its status code and response.
      </p>
    </div>

    <div class="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-2">
      <h3 class="font-medium text-sm mb-3">
        {{ t('settings.pages.unichan.telegram.title') }}
      </h3>
      <FieldCheckbox
        v-model="telegramEnabled"
        :label="t('settings.pages.unichan.telegram.enabled')"
      />
      <FieldInput
        v-model="telegramToken"
        type="password"
        :label="t('settings.pages.unichan.telegram.token.label')"
        :description="t('settings.pages.unichan.telegram.token.description')"
        placeholder="Bot token from @BotFather"
        class="mt-3"
      />
      <FieldInput
        v-model="telegramAllowFrom"
        :label="t('settings.pages.unichan.telegram.allowFrom.label')"
        :description="t('settings.pages.unichan.telegram.allowFrom.description')"
        placeholder="username1, username2"
        class="mt-3"
      />
    </div>

    <div class="flex items-center gap-3 pt-2">
      <Button
        variant="primary"
        size="md"
        :label="saving ? t('settings.pages.unichan.saving') : t('settings.pages.unichan.save')"
        :disabled="saving"
        :loading="saving"
        @click="save"
      />
      <span v-if="saveMessage" class="text-sm" :class="saveMessage === t('settings.pages.unichan.saved') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
        {{ saveMessage }}
      </span>
    </div>
    <p class="text-neutral-500 dark:text-neutral-500 text-xs">
      {{ t('settings.pages.unichan.restartHint') }}
    </p>
    <p class="text-neutral-400 dark:text-neutral-500 text-xs mt-1">
      {{ t('settings.pages.unichan.configPath') }}
    </p>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.unichan.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.unichan.description
  icon: i-solar:server-bold-duotone
  # Not in top-level menu; reachable from Settings → Modules → Consciousness → "Configure remote brain"
  stageTransition:
    name: slide
</route>
