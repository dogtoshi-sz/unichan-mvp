<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'
import type { ChatProvider } from '@xsai-ext/providers/utils'

import { MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useInlineChatStore } from '../stores/inline-chat'
import { widgetsTools } from '../stores/tools/builtin/widgets'

const BUBBLE_DISPLAY_DURATION = 8000 // ms before bubble starts fading
const BUBBLE_FADE_DURATION = 500 // ms for fade-out animation

interface VisibleBubble {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
  slices?: { type: string, text?: string }[]
  createdAt: number
  visible: boolean
  fading: boolean
}

const messageInput = ref('')
const bubblesEndRef = ref<HTMLElement>()
const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()
const inlineChatStore = useInlineChatStore()
const { ingest, onAfterMessageComposed } = chatOrchestrator
const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)
const { t } = useI18n()
const providersStore = useProvidersStore()
const { activeModel, activeProvider } = storeToRefs(useConsciousnessStore())
const isComposing = ref(false)

// Track visible bubbles with auto-dismiss
const visibleBubbles = ref<VisibleBubble[]>([])
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

function getMessageText(item: ChatHistoryItem): string {
  if (item.role === 'error' && typeof item.content === 'string')
    return item.content
  const raw = (item as { content?: string | unknown[] }).content
  if (typeof raw === 'string')
    return raw
  if (Array.isArray(raw)) {
    const textPart = raw.find((p: unknown) => p && typeof p === 'object' && 'text' in p) as { text?: string } | undefined
    return textPart?.text ?? ''
  }
  return ''
}

function scheduleDismiss(id: string) {
  if (dismissTimers.has(id))
    return
  const timer = setTimeout(() => {
    const bubble = visibleBubbles.value.find(b => b.id === id)
    if (bubble) {
      bubble.fading = true
      setTimeout(() => {
        visibleBubbles.value = visibleBubbles.value.filter(b => b.id !== id)
        dismissTimers.delete(id)
      }, BUBBLE_FADE_DURATION)
    }
  }, BUBBLE_DISPLAY_DURATION)
  dismissTimers.set(id, timer)
}

function addBubble(role: 'user' | 'assistant' | 'error', text: string, slices?: { type: string, text?: string }[], existingId?: string) {
  const id = existingId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const existing = visibleBubbles.value.find(b => b.id === id)
  if (existing) {
    // Update existing (for streaming)
    existing.text = text
    existing.slices = slices
    return id
  }
  visibleBubbles.value.push({
    id,
    role,
    text,
    slices,
    createdAt: Date.now(),
    visible: true,
    fading: false,
  })
  // Only auto-dismiss non-streaming messages
  if (role !== 'assistant' || !sending.value) {
    scheduleDismiss(id)
  }
  return id
}

// Track last user message to avoid duplicates
let lastUserMessageText = ''
const currentStreamingId = ref<string | null>(null)

const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

// Watch for new messages and add as bubbles
watch(historyMessages, (newMessages, oldMessages) => {
  const oldLen = oldMessages?.length ?? 0
  if (newMessages.length > oldLen) {
    // New message(s) added
    for (let i = oldLen; i < newMessages.length; i++) {
      const msg = newMessages[i]
      const text = getMessageText(msg)
      if (msg.role === 'user' && text !== lastUserMessageText) {
        lastUserMessageText = text
        addBubble('user', text)
      }
      else if (msg.role === 'assistant') {
        const slices = (msg as { slices?: { type: string, text?: string }[] }).slices
        const id = addBubble('assistant', text, slices)
        scheduleDismiss(id)
      }
      else if (msg.role === 'error') {
        addBubble('error', text)
      }
    }
  }
}, { deep: true })

// Watch streaming message
watch([streamingMessage, sending], ([stream, isSending]) => {
  if (isSending && stream) {
    const text = stream.content ?? '...'
    const slices = stream.slices ?? []
    if (!currentStreamingId.value) {
      currentStreamingId.value = addBubble('assistant', text, slices)
    }
    else {
      const bubble = visibleBubbles.value.find(b => b.id === currentStreamingId.value)
      if (bubble) {
        bubble.text = text
        bubble.slices = slices
      }
    }
  }
  else if (!isSending && currentStreamingId.value) {
    // Streaming done, schedule dismiss
    scheduleDismiss(currentStreamingId.value)
    currentStreamingId.value = null
  }
})

async function handleSend() {
  if (isComposing.value || !messageInput.value.trim())
    return
  if (!activeProvider.value || !activeModel.value) {
    addBubble('error', 'Select a brain first: Settings → Consciousness choose "OpenClaw (Unichan brain)", then Settings → Unichan set port and Gateway token, Save.')
    return
  }
  const textToSend = messageInput.value
  messageInput.value = ''
  lastUserMessageText = textToSend
  addBubble('user', textToSend)
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
    addBubble('error', (error as Error).message)
  }
}

onAfterMessageComposed(() => {
  messageInput.value = ''
})

watch(visibleBubbles, () => {
  requestAnimationFrame(() => {
    bubblesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  })
}, { deep: true })

onUnmounted(() => {
  dismissTimers.forEach(timer => clearTimeout(timer))
  dismissTimers.clear()
})
</script>

<template>
  <div
    class="floating-bubbles-overlay"
    absolute inset-0 z-10
    flex="~ col"
    pointer-events-none
  >
    <!-- Bubbles area: above the character, top portion -->
    <div
      class="bubbles-scroll"
      flex="~ col"
      gap-3
      overflow-y-auto
      overflow-x-hidden
      pt-5 pb-2 px-5
      pointer-events-auto
      flex-1
      min-h-0
      justify-start
    >
      <TransitionGroup
        name="imessage"
        tag="div"
        class="flex flex-col gap-3"
      >
        <template v-for="bubble in visibleBubbles" :key="bubble.id">
          <!-- User bubble: right side, blue like iMessage -->
          <div
            v-if="bubble.role === 'user'"
            class="imessage-row imessage-row-user"
            :class="{ 'imessage-fading': bubble.fading }"
          >
            <div class="imessage-bubble imessage-user">
              <span class="imessage-text">{{ bubble.text }}</span>
              <div class="imessage-tail imessage-tail-user" />
            </div>
          </div>
          <!-- Assistant bubble: left side, gray like iMessage -->
          <div
            v-else-if="bubble.role === 'assistant'"
            class="imessage-row imessage-row-assistant"
            :class="{ 'imessage-fading': bubble.fading }"
          >
            <div class="imessage-bubble imessage-assistant">
              <template v-if="bubble.slices?.length">
                <template v-for="(slice, si) in bubble.slices" :key="si">
                  <MarkdownRenderer
                    v-if="slice.type === 'text' && slice.text"
                    :content="slice.text"
                    class="imessage-text"
                  />
                </template>
              </template>
              <template v-else>
                <MarkdownRenderer
                  :content="bubble.text || '...'"
                  class="imessage-text"
                />
              </template>
              <span v-if="sending && bubble.id === currentStreamingId" class="typing-cursor" />
              <div class="imessage-tail imessage-tail-assistant" />
            </div>
          </div>
          <!-- Error bubble: center, red -->
          <div
            v-else-if="bubble.role === 'error'"
            class="imessage-row imessage-row-error"
            :class="{ 'imessage-fading': bubble.fading }"
          >
            <div class="imessage-bubble imessage-error">
              <span class="imessage-text">{{ bubble.text }}</span>
            </div>
          </div>
        </template>
      </TransitionGroup>
      <div ref="bubblesEndRef" />
    </div>

    <!-- Input bar -->
    <div
      class="input-bar"
      shrink-0
      pointer-events-auto
    >
      <div
        class="input-bar-inner"
        flex items-center gap-3
        rounded-full
        backdrop-blur-xl
        px-5 py-3
      >
        <input
          v-model="messageInput"
          type="text"
          :placeholder="t('stage.message', 'Say something...')"
          class="ph-no-capture flex-1 min-w-0 bg-transparent text-base font-medium text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none"
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
          @keydown.enter.exact.prevent="handleSend()"
        >
        <button
          type="button"
          class="shrink-0 rounded-full p-1.5 transition-colors duration-150"
          text="neutral-400 hover:neutral-600 dark:neutral-500 dark:hover:neutral-300"
          title="Close"
          @click="inlineChatStore.close()"
        >
          <div i-solar:close-circle-bold class="size-6" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floating-bubbles-overlay {
  padding: 0;
  overflow: visible;
}

.bubbles-scroll {
  scroll-behavior: smooth;
  max-height: 48%;
}

/* Organized rows – clear alignment */
.imessage-row {
  display: flex;
  width: 100%;
  padding: 0 8px;
  max-width: 100%;
}

.imessage-row-user {
  justify-content: flex-end;
}

.imessage-row-assistant {
  justify-content: flex-start;
}

.imessage-row-error {
  justify-content: center;
}

/* Bubbly bubbles – round, soft, organized */
.imessage-bubble {
  position: relative;
  max-width: min(85%, 340px);
  padding: 14px 20px;
  border-radius: 24px;
  font-size: 15px;
  font-weight: 450;
  line-height: 1.5;
  letter-spacing: -0.01em;
  word-wrap: break-word;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* User bubble – blue, bubbly */
.imessage-user {
  background: linear-gradient(145deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);
  color: #fff;
  border-radius: 24px 24px 8px 24px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

/* Assistant bubble – soft frosted, bubbly */
.imessage-assistant {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%);
  color: #1e293b;
  border-radius: 24px 24px 24px 8px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.06),
    0 8px 28px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
.dark .imessage-assistant {
  background: linear-gradient(145deg, rgba(51, 65, 85, 0.95) 0%, rgba(30, 41, 59, 0.92) 100%);
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.2),
    0 8px 28px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Error bubble */
.imessage-error {
  background: linear-gradient(145deg, #ef4444 0%, #dc2626 100%);
  color: #fff;
  border-radius: 24px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.imessage-text {
  display: inline;
}

/* Markdown inside bubbles */
.imessage-bubble :deep(p) {
  margin: 0;
}
.imessage-bubble :deep(code) {
  background: rgba(0, 0, 0, 0.08);
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 13px;
}
.dark .imessage-bubble :deep(code) {
  background: rgba(255, 255, 255, 0.12);
}

/* Bubble tails – softer, rounder */
.imessage-tail-user {
  position: absolute;
  bottom: 0;
  right: -6px;
  width: 16px;
  height: 20px;
  background: linear-gradient(145deg, #3b82f6 0%, #2563eb 100%);
  border-bottom-left-radius: 20px 18px;
  clip-path: polygon(0 0, 100% 100%, 0 100%);
}

.imessage-tail-assistant {
  position: absolute;
  bottom: 0;
  left: -6px;
  width: 16px;
  height: 20px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%);
  border-bottom-right-radius: 20px 18px;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}
.dark .imessage-tail-assistant {
  background: linear-gradient(145deg, rgba(51, 65, 85, 0.95) 0%, rgba(30, 41, 59, 0.92) 100%);
}

/* Typing indicator */
.typing-cursor {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
  vertical-align: middle;
}
.typing-cursor::before,
.typing-cursor::after,
.typing-cursor {
  content: '';
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0.6;
  animation: typingBounce 1.4s ease-in-out infinite;
}
.typing-cursor::before { animation-delay: 0s; }
.typing-cursor { animation-delay: 0.2s; }
.typing-cursor::after { animation-delay: 0.4s; }

@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

/* Fading */
.imessage-fading {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}

/* Input bar */
.input-bar {
  flex-shrink: 0;
  padding: 10px 14px 14px;
}

.input-bar-inner {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 9999px;
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.06),
    0 0 1px rgba(0, 0, 0, 0.08);
}
.dark .input-bar-inner {
  background: rgba(44, 44, 46, 0.96);
  border-color: rgba(255, 255, 255, 0.08);
}

/* Enter/leave – bouncy */
.imessage-enter-active {
  transition:
    opacity 0.3s ease-out,
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.imessage-enter-from {
  opacity: 0;
  transform: scale(0.85) translateY(-12px);
}
.imessage-enter-to {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.imessage-leave-active {
  transition: opacity 0.35s ease-out, transform 0.35s ease-out;
}
.imessage-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-8px);
}

.imessage-move {
  transition: transform 0.3s ease-out;
}
</style>
