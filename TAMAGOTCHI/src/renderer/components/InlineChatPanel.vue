<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'
import type { ChatProvider } from '@xsai-ext/providers/utils'

import { ChatHistory } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatMaintenanceStore } from '@proj-airi/stage-ui/stores/chat/maintenance'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { BasicTextarea } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useInlineChatStore } from '../stores/inline-chat'
import { widgetsTools } from '../stores/tools/builtin/widgets'

const messageInput = ref('')
const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()
const inlineChatStore = useInlineChatStore()
const { cleanupMessages } = useChatMaintenanceStore()
const { ingest, onAfterMessageComposed, discoverToolsCompatibility } = chatOrchestrator
const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)
const { t } = useI18n()
const providersStore = useProvidersStore()
const { activeModel, activeProvider } = storeToRefs(useConsciousnessStore())
const isComposing = ref(false)

async function handleSend() {
  if (isComposing.value || !messageInput.value.trim())
    return
  if (!activeProvider.value || !activeModel.value) {
    messages.value.push({
      role: 'error',
      content: 'Select a brain first: Settings → Consciousness choose "OpenClaw (Unichan brain)", then Settings → Unichan set port (e.g. 18789) and Gateway token, Save.',
    })
    return
  }
  const textToSend = messageInput.value
  messageInput.value = ''
  try {
    await ingest(textToSend, {
      model: activeModel.value,
      chatProvider: await providersStore.getProviderInstance<ChatProvider>(activeProvider.value),
      providerConfig: providersStore.getProviderConfig(activeProvider.value),
      tools: widgetsTools,
    })
  }
  catch (error) {
    messageInput.value = textToSend
    messages.value.push({
      role: 'error',
      content: (error as Error).message,
    })
  }
}

onAfterMessageComposed(() => {
  messageInput.value = ''
})

watch([activeProvider, activeModel], async () => {
  if (activeProvider.value && activeModel.value)
    await discoverToolsCompatibility(activeModel.value, await providersStore.getProviderInstance<ChatProvider>(activeProvider.value), [])
}, { immediate: true })

const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])
</script>

<template>
  <div
    class="inline-chat-panel"
    flex="~ col"
    h-full
    w-full
    max-w-sm
    shrink-0
    overflow-hidden
    rounded-l-xl
    bg="white/95 dark:neutral-900/95"
    backdrop-blur-md
    border="r-1 neutral-200 dark:neutral-700"
    shadow="lg"
  >
    <div flex items-center justify-between shrink-0 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700>
      <span text-sm font-medium text-neutral-700 dark:text-neutral-200>
        {{ t('stage.chat.title', 'Chat') }}
      </span>
      <div flex items-center gap-1>
        <button
          type="button"
          p-1.5 rounded-md
          text="neutral-500 hover:neutral-700 dark:neutral-400 dark:hover:neutral-200"
          title="Clear messages"
          @click="cleanupMessages()"
        >
          <div i-solar:trash-bin-2-bold-duotone class="size-4" />
        </button>
        <button
          type="button"
          p-1.5 rounded-md
          text="neutral-500 hover:neutral-700 dark:neutral-400 dark:hover:neutral-200"
          title="Close"
          @click="inlineChatStore.close()"
        >
          <div i-solar:close-circle-bold-duotone class="size-4" />
        </button>
      </div>
    </div>
    <div flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 min-h-0>
      <ChatHistory
        :messages="historyMessages"
        :sending="sending"
        :streaming-message="streamingMessage"
        variant="mobile"
        class="gap-1.5"
      />
    </div>
    <div shrink-0 border-t border-neutral-200 p-2 dark:border-neutral-700>
      <BasicTextarea
        v-model="messageInput"
        :placeholder="t('stage.message', 'Say something...')"
        class="ph-no-capture"
        text="sm primary-600 dark:primary-100 placeholder:primary-500 dark:placeholder:primary-200"
        border="solid 1 neutral-200 dark:neutral-600"
        bg="neutral-50 dark:neutral-800"
        max-h="[8lh]" min-h="[2.5lh]"
        w-full resize-none overflow-y-auto rounded-lg px-3 py-2 text-sm outline-none
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
        @keydown.enter.exact.prevent="handleSend"
      />
    </div>
  </div>
</template>
