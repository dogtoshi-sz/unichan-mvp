import type { WebSocketEventInputs } from '@proj-airi/server-sdk'
import type { ChatProvider } from '@xsai-ext/providers/utils'
import type { CommonContentPart, Message, ToolMessage } from '@xsai/shared-chat'

import type { ChatAssistantMessage, ChatSlices, ChatStreamEventContext, StreamingAssistantMessage } from '../types/chat'
import type { StreamEvent, StreamOptions } from './llm'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { createQueue } from '@proj-airi/stream-kit'
import { nanoid } from 'nanoid'
import { defineStore, storeToRefs } from 'pinia'
import { ref, toRaw } from 'vue'

import { useAnalytics } from '../composables'
import { useModsServerChannelStore } from './mods/api/channel-server'
import { useLlmmarkerParser } from '../composables/llm-marker-parser'
import { categorizeResponse, createStreamingCategorizer } from '../composables/response-categoriser'
import { createDatetimeContext } from './chat/context-providers'
import { useChatContextStore } from './chat/context-store'
import { createChatHooks } from './chat/hooks'
import { useChatSessionStore } from './chat/session-store'
import { useChatStreamStore } from './chat/stream-store'
import { useLLM } from './llm'
import { useConsciousnessStore } from './modules/consciousness'
import { useVisionStore } from './modules/vision'

interface SendOptions {
  model: string
  chatProvider: ChatProvider
  providerConfig?: Record<string, unknown>
  attachments?: { type: 'image', data: string, mimeType: string }[]
  tools?: StreamOptions['tools']
  input?: WebSocketEventInputs
}

interface ForkOptions {
  fromSessionId?: string
  atIndex?: number
  reason?: string
  hidden?: boolean
}

interface QueuedSend {
  sendingMessage: string
  options: SendOptions
  generation: number
  sessionId: string
  cancelled?: boolean
  deferred: {
    resolve: () => void
    reject: (error: unknown) => void
  }
}

function getHttpStatusFromError(error: unknown): number | undefined {
  if (error == null) return undefined
  const o = error as Record<string, unknown>
  if (typeof o.status === 'number') return o.status
  if (o.response && typeof (o.response as Record<string, unknown>).status === 'number')
    return (o.response as Record<string, unknown>).status as number
  if (o.cause) return getHttpStatusFromError(o.cause)
  return undefined
}

export const useChatOrchestratorStore = defineStore('chat-orchestrator', () => {
  const llmStore = useLLM()
  const consciousnessStore = useConsciousnessStore()
  const { activeProvider } = storeToRefs(consciousnessStore)
  const { trackFirstMessage } = useAnalytics()

  const chatSession = useChatSessionStore()
  const chatStream = useChatStreamStore()
  const chatContext = useChatContextStore()
  const visionStore = useVisionStore()
  const serverChannelStore = useModsServerChannelStore()
  const { activeSessionId } = storeToRefs(chatSession)

  const VISION_REQUEST_PATTERN = /\b(capture|screenshot|take a (pic|picture|screenshot)|what do you see|what('s| is) on my (screen|browser)|show me (my )?(screen|browser)|see (my )?screen|grab (my )?screen|can you see (my )?screen)\b/i
  function isVisionRequest(text: string): boolean {
    return VISION_REQUEST_PATTERN.test(text.trim())
  }
  const { streamingMessage } = storeToRefs(chatStream)

  const sending = ref(false)
  const pendingQueuedSends = ref<QueuedSend[]>([])
  const hooks = createChatHooks()

  const sendQueue = createQueue<QueuedSend>({
    handlers: [
      async ({ data }) => {
        const { sendingMessage, options, generation, deferred, sessionId, cancelled } = data

        if (cancelled)
          return

        if (chatSession.getSessionGeneration(sessionId) !== generation) {
          deferred.reject(new Error('Chat session was reset before send could start'))
          return
        }

        try {
          await performSend(sendingMessage, options, generation, sessionId)
          deferred.resolve()
        }
        catch (error) {
          deferred.reject(error)
        }
      },
    ],
  })

  sendQueue.on('enqueue', (queuedSend) => {
    pendingQueuedSends.value = [...pendingQueuedSends.value, queuedSend]
  })

  sendQueue.on('dequeue', (queuedSend) => {
    pendingQueuedSends.value = pendingQueuedSends.value.filter(item => item !== queuedSend)
  })

  async function performSend(
    sendingMessage: string,
    options: SendOptions,
    generation: number,
    sessionId: string,
  ) {
    if (!sendingMessage && !options.attachments?.length)
      return

    // Brain resolver now always returns a URL when OpenClaw is selected (default port if not set). No need to block here.

    chatSession.ensureSession(sessionId)

    // If user asks to see/capture the screen (voice or text), ask the extension to capture so this turn gets the screenshot
    if (isStageTamagotchi() && serverChannelStore.connected && isVisionRequest(sendingMessage)) {
      serverChannelStore.send({
        type: 'spark:emit',
        data: {
          id: nanoid(),
          state: 'queued',
          note: 'request-vision-frame',
          destinations: ['label:runtime=web-extension'],
        },
      })
      await new Promise(resolve => setTimeout(resolve, 1800))
    }

    // Inject current datetime context before composing the message
    chatContext.ingestContextMessage(createDatetimeContext())

    const sendingCreatedAt = Date.now()
    const streamingMessageContext: ChatStreamEventContext = {
      message: { role: 'user', content: sendingMessage, createdAt: sendingCreatedAt, id: nanoid() },
      contexts: chatContext.getContextsSnapshot(),
      composedMessage: [],
      input: options.input,
    }

    const isStaleGeneration = () => chatSession.getSessionGeneration(sessionId) !== generation
    const shouldAbort = () => isStaleGeneration()
    if (shouldAbort())
      return

    sending.value = true

    const isForegroundSession = () => sessionId === activeSessionId.value

    const buildingMessage: StreamingAssistantMessage = { role: 'assistant', content: '', slices: [], tool_results: [], createdAt: Date.now(), id: nanoid() }

    const updateUI = () => {
      if (isForegroundSession()) {
        streamingMessage.value = JSON.parse(JSON.stringify(buildingMessage))
      }
    }

    updateUI()
    trackFirstMessage()

    try {
      await hooks.emitBeforeMessageComposedHooks(sendingMessage, streamingMessageContext)

      const contentParts: CommonContentPart[] = [{ type: 'text', text: sendingMessage }]

      if (options.attachments) {
        for (const attachment of options.attachments) {
          if (attachment.type === 'image') {
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${attachment.mimeType};base64,${attachment.data}`,
              },
            })
          }
        }
      }

      const finalContent = contentParts.length > 1 ? contentParts : sendingMessage
      if (!streamingMessageContext.input) {
        streamingMessageContext.input = {
          type: 'input:text',
          data: {
            text: sendingMessage,
          },
        }
      }

      if (shouldAbort())
        return

      const sessionMessagesForSend = chatSession.getSessionMessages(sessionId)
      sessionMessagesForSend.push({ role: 'user', content: finalContent, createdAt: sendingCreatedAt, id: nanoid() })
      chatSession.persistSessionMessages(sessionId)

      const categorizer = createStreamingCategorizer(activeProvider.value)
      let streamPosition = 0

      const parser = useLlmmarkerParser({
        onLiteral: async (literal) => {
          if (shouldAbort())
            return

          categorizer.consume(literal)

          const speechOnly = categorizer.filterToSpeech(literal, streamPosition)
          streamPosition += literal.length

          if (speechOnly.trim()) {
            buildingMessage.content += speechOnly

            await hooks.emitTokenLiteralHooks(speechOnly, streamingMessageContext)

            const lastSlice = buildingMessage.slices.at(-1)
            if (lastSlice?.type === 'text') {
              lastSlice.text += speechOnly
            }
            else {
              buildingMessage.slices.push({
                type: 'text',
                text: speechOnly,
              })
            }
            updateUI()
          }
        },
        onSpecial: async (special) => {
          if (shouldAbort())
            return

          await hooks.emitTokenSpecialHooks(special, streamingMessageContext)
        },
        onEnd: async (fullText) => {
          if (isStaleGeneration())
            return

          const finalCategorization = categorizeResponse(fullText, activeProvider.value)

          buildingMessage.categorization = {
            speech: finalCategorization.speech,
            reasoning: finalCategorization.reasoning,
          }
          updateUI()
        },
        minLiteralEmitLength: 24,
      })

      const toolCallQueue = createQueue<ChatSlices>({
        handlers: [
          async (ctx) => {
            if (shouldAbort())
              return
            if (ctx.data.type === 'tool-call') {
              buildingMessage.slices.push(ctx.data)
              updateUI()
              return
            }

            if (ctx.data.type === 'tool-call-result') {
              buildingMessage.tool_results.push(ctx.data)
              updateUI()
            }
          },
        ],
      })

      let newMessages = sessionMessagesForSend.map((msg) => {
        const { context: _context, id: _id, ...withoutContext } = msg
        const rawMessage = toRaw(withoutContext)

        if (rawMessage.role === 'assistant') {
          const { slices: _slices, tool_results, categorization: _categorization, ...rest } = rawMessage as ChatAssistantMessage
          return {
            ...toRaw(rest),
            tool_results: toRaw(tool_results),
          }
        }

        return rawMessage
      })

      const contextsSnapshot = chatContext.getContextsSnapshot()
      if (Object.keys(contextsSnapshot).length > 0) {
        const system = newMessages.slice(0, 1)
        const afterSystem = newMessages.slice(1, newMessages.length)

        const isBrowserContext = (key: string, value: unknown) => {
          if (key.includes('plugin-web-extension'))
            return true
          const list = Array.isArray(value) ? value : []
          return list.some((m: { lane?: string, metadata?: { source?: string } }) =>
            (typeof m?.lane === 'string' && m.lane.startsWith('web:'))
            || m?.metadata?.source === 'web-extension',
          )
        }

        /** Redact base64 image data from context for the text prompt so we don't blow token limit. */
        const redactForPrompt = (list: unknown[]): unknown[] => list.map((m: Record<string, unknown>) => {
          const meta = m?.metadata as Record<string, unknown> | undefined
          if (meta && 'imageDataUrl' in meta) {
            return { ...m, metadata: { ...meta, imageDataUrl: '[Screenshot attached]' } }
          }
          return m
        })

        const moduleDescriptions = Object.entries(contextsSnapshot).map(([key, value]) => {
          const list = Array.isArray(value) ? value : []
          const redacted = redactForPrompt(list)
          const isBrowser = isBrowserContext(key, value)
          const desc = isBrowser
            ? 'Browser (Chrome extension): current page title/URL; on YouTube/Bilibili also video title and live subtitles; may include a screenshot.'
            : null
          return desc ? `[${key}]: ${desc}\nData: ${JSON.stringify(redacted)}` : `Module ${key}: ${JSON.stringify(redacted)}`
        })

        const hasBrowserExtension = Object.entries(contextsSnapshot).some(([k, v]) => isBrowserContext(k, v))
        const browserPreamble = hasBrowserExtension
          ? 'You have access to the user\'s browser context from a Chrome extension. The data below is what they are currently viewing (page, and on video sites: video title and subtitles). When the user asks "what do you see", "what\'s on my browser", or "what am I watching", you MUST answer using this data. Do NOT say you cannot see their browser or screen—you can, via the data below.\n\n'
          : ''

        const visionImageUrls: string[] = []
        for (const list of Object.values(contextsSnapshot)) {
          const arr = Array.isArray(list) ? list : []
          for (const msg of arr) {
            const m = msg as { lane?: string, metadata?: { imageDataUrl?: string } }
            if (m?.lane === 'web:vision' && m.metadata?.imageDataUrl)
              visionImageUrls.push(m.metadata.imageDataUrl)
          }
        }
        const includeVisionImages = visionStore.includeBrowserScreenshot && visionImageUrls.length > 0
        const contextContent: Array<{ type: 'text', text: string } | { type: 'image_url', image_url: { url: string } }> = [
          {
            type: 'text',
            text: ''
              + browserPreamble
              + 'Contextual information from other modules (use as context for chat or for the next action/tool call):\n'
              + moduleDescriptions.join('\n') + '\n',
          },
        ]
        if (includeVisionImages) {
          for (const url of visionImageUrls)
            contextContent.push({ type: 'image_url', image_url: { url } })
        }

        newMessages = [
          ...system,
          {
            role: 'user',
            content: contextContent,
          },
          ...afterSystem,
        ]
      }

      streamingMessageContext.composedMessage = newMessages as Message[]

      await hooks.emitAfterMessageComposedHooks(sendingMessage, streamingMessageContext)
      await hooks.emitBeforeSendHooks(sendingMessage, streamingMessageContext)

      let fullText = ''
      const headers = (options.providerConfig?.headers || {}) as Record<string, string>
      const extraBody: Record<string, unknown> = {}
      if (consciousnessStore.useOpenClaw) {
        const token = (consciousnessStore.gatewayToken ?? '').trim()
        if (token) headers.Authorization = `Bearer ${token}`
        const sessionKey = (consciousnessStore.gatewaySessionKey ?? '').trim() || 'agent:main:main'
        headers['X-OpenClaw-Session'] = sessionKey
        // Also pass session in the body — Chromium lowercases headers, so some
        // gateways may not see X-OpenClaw-Session.  The body field is a fallback.
        extraBody.session = sessionKey
        extraBody.user = sessionKey
      }
      else if (consciousnessStore.gatewaySessionKey?.trim()) {
        const sessionKey = consciousnessStore.gatewaySessionKey.trim()
        headers['X-OpenClaw-Session'] = sessionKey
        extraBody.session = sessionKey
        extraBody.user = sessionKey
      }

      if (shouldAbort())
        return

      const chatOpts = options.chatProvider.chat(options.model)
      if (typeof console !== 'undefined' && console.info) {
        console.info(
          '[Chat] Sending to brain:',
          {
            baseURL: chatOpts.baseURL,
            model: options.model,
            hasAuth: !!headers.Authorization,
            sessionKey: headers['X-OpenClaw-Session'] ?? '(missing)',
            allHeaders: Object.keys(headers),
          },
          '\nIf no request appears in the OpenClaw gateway, enable HTTP chat: gateway.http.endpoints.chatCompletions.enabled in ~/.openclaw/openclaw.json',
        )
      }

      const STREAM_TIMEOUT_MS = 90_000
      const streamPromise = llmStore.stream(options.model, options.chatProvider, newMessages as Message[], {
        headers,
        extraBody,
        tools: options.tools,
        onStreamEvent: async (event: StreamEvent) => {
          switch (event.type) {
            case 'tool-call':
              toolCallQueue.enqueue({
                type: 'tool-call',
                toolCall: event,
              })

              break
            case 'tool-result':
              toolCallQueue.enqueue({
                type: 'tool-call-result',
                id: event.toolCallId,
                result: event.result,
              })

              break
            case 'text-delta':
              fullText += event.text
              await parser.consume(event.text)
              break
            case 'finish':
              break
            case 'error':
              throw event.error ?? new Error('Stream error')
          }
        },
      })
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Chat timed out. The brain may be unreachable or slow. Check the URL, token, and network.')), STREAM_TIMEOUT_MS)
      })
      await Promise.race([streamPromise, timeoutPromise])

      await parser.end()

      if (!isStaleGeneration() && buildingMessage.slices.length > 0) {
        sessionMessagesForSend.push(toRaw(buildingMessage))
        chatSession.persistSessionMessages(sessionId)
      }

      await hooks.emitStreamEndHooks(streamingMessageContext)
      await hooks.emitAssistantResponseEndHooks(fullText, streamingMessageContext)

      await hooks.emitAfterSendHooks(sendingMessage, streamingMessageContext)
      await hooks.emitAssistantMessageHooks({ ...buildingMessage }, fullText, streamingMessageContext)
      await hooks.emitChatTurnCompleteHooks({
        output: { ...buildingMessage },
        outputText: fullText,
        toolCalls: sessionMessagesForSend.filter(msg => msg.role === 'tool') as ToolMessage[],
      }, streamingMessageContext)

      if (isForegroundSession()) {
        streamingMessage.value = { role: 'assistant', content: '', slices: [], tool_results: [] }
      }
    }
    catch (error) {
      if (sessionId === activeSessionId.value) {
        chatStream.resetStream()
      }
      const msg = error instanceof Error ? error.message : String(error)
      const status = getHttpStatusFromError(error)
      const is405 = status === 405 || /405|Method Not Allowed/i.test(msg)
      const is401 = status === 401 || /401|Unauthorized/i.test(msg)
      const hint405 = is405
        ? ' OpenClaw: enable HTTP chat in %USERPROFILE%\\.openclaw\\openclaw.json under gateway.http.endpoints.chatCompletions.enabled: true, then restart the gateway.'
        : ' If you see 405 in the Network tab: enable the chat endpoint in your gateway config (see docs/INSTALLATION.md).'
      console.error('Chat request failed:', msg, hint405, error)
      let userMessage = msg
      if (is405) {
        userMessage = `Gateway returned 405 (Method Not Allowed). Enable HTTP chat in OpenClaw: edit %USERPROFILE%\\.openclaw\\openclaw.json, add "http": { "endpoints": { "chatCompletions": { "enabled": true } } } under "gateway", save, and restart the gateway. See docs/INSTALLATION.md.`
      }
      else if (is401) {
        userMessage = 'Gateway returned 401 (Unauthorized). Set the Gateway token in Settings → Unichan: copy the token from OpenClaw (Overview → Gateway Access → Gateway Token) or from the "gateway.auth.token" field in %USERPROFILE%\\.openclaw\\openclaw.json, paste it in the Gateway token field, then Save.'
      }
      throw new Error(userMessage)
    }
    finally {
      sending.value = false
    }
  }

  async function ingest(
    sendingMessage: string,
    options: SendOptions,
    targetSessionId?: string,
  ) {
    const sessionId = targetSessionId || activeSessionId.value
    const generation = chatSession.getSessionGeneration(sessionId)

    return new Promise<void>((resolve, reject) => {
      sendQueue.enqueue({
        sendingMessage,
        options,
        generation,
        sessionId,
        deferred: { resolve, reject },
      })
    })
  }

  async function ingestOnFork(
    sendingMessage: string,
    options: SendOptions,
    forkOptions?: ForkOptions,
  ) {
    const baseSessionId = forkOptions?.fromSessionId ?? activeSessionId.value
    if (!forkOptions)
      return ingest(sendingMessage, options, baseSessionId)

    const forkSessionId = await chatSession.forkSession({
      fromSessionId: baseSessionId,
      atIndex: forkOptions.atIndex,
      reason: forkOptions.reason,
      hidden: forkOptions.hidden,
    })
    return ingest(sendingMessage, options, forkSessionId || baseSessionId)
  }

  function cancelPendingSends(sessionId?: string) {
    for (const queued of pendingQueuedSends.value) {
      if (sessionId && queued.sessionId !== sessionId)
        continue

      queued.cancelled = true
      queued.deferred.reject(new Error('Chat session was reset before send could start'))
    }

    pendingQueuedSends.value = sessionId
      ? pendingQueuedSends.value.filter(item => item.sessionId !== sessionId)
      : []
  }

  return {
    sending,

    discoverToolsCompatibility: llmStore.discoverToolsCompatibility,

    ingest,
    ingestOnFork,
    cancelPendingSends,

    clearHooks: hooks.clearHooks,

    emitBeforeMessageComposedHooks: hooks.emitBeforeMessageComposedHooks,
    emitAfterMessageComposedHooks: hooks.emitAfterMessageComposedHooks,
    emitBeforeSendHooks: hooks.emitBeforeSendHooks,
    emitAfterSendHooks: hooks.emitAfterSendHooks,
    emitTokenLiteralHooks: hooks.emitTokenLiteralHooks,
    emitTokenSpecialHooks: hooks.emitTokenSpecialHooks,
    emitStreamEndHooks: hooks.emitStreamEndHooks,
    emitAssistantResponseEndHooks: hooks.emitAssistantResponseEndHooks,
    emitAssistantMessageHooks: hooks.emitAssistantMessageHooks,
    emitChatTurnCompleteHooks: hooks.emitChatTurnCompleteHooks,

    onBeforeMessageComposed: hooks.onBeforeMessageComposed,
    onAfterMessageComposed: hooks.onAfterMessageComposed,
    onBeforeSend: hooks.onBeforeSend,
    onAfterSend: hooks.onAfterSend,
    onTokenLiteral: hooks.onTokenLiteral,
    onTokenSpecial: hooks.onTokenSpecial,
    onStreamEnd: hooks.onStreamEnd,
    onAssistantResponseEnd: hooks.onAssistantResponseEnd,
    onAssistantMessage: hooks.onAssistantMessage,
    onChatTurnComplete: hooks.onChatTurnComplete,
  }
})
