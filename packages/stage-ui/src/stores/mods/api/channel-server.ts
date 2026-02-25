import type { ContextUpdate, WebSocketBaseEvent, WebSocketEvent, WebSocketEventOptionalSource, WebSocketEvents } from '@proj-airi/server-sdk'

import { Client, WebSocketEventSource } from '@proj-airi/server-sdk'
import { isStageTamagotchi, isStageWeb } from '@proj-airi/stage-shared'
import { useLocalStorage } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useWebSocketInspectorStore } from '../../devtools/websocket-inspector'

export const useModsServerChannelStore = defineStore('mods:channels:proj-airi:server', () => {
  const connected = ref(false)
  const client = ref<Client>()
  const initializing = ref<Promise<void> | null>(null)
  const pendingSend = ref<Array<WebSocketEvent>>([])
  const listenersInitialized = ref(false)
  const listenerDisposers = ref<Array<() => void>>([])

  const defaultWebSocketUrl = import.meta.env.VITE_AIRI_WS_URL || 'ws://localhost:6121/ws'
  const websocketUrl = useLocalStorage('settings/connection/websocket-url', defaultWebSocketUrl)
  const channelErrorHintLogged = ref(false)
  const channelVsChatInfoLogged = ref(false)

  const basePossibleEvents: Array<keyof WebSocketEvents> = [
    'context:update',
    'error',
    'module:announce',
    'module:configure',
    'module:authenticated',
    'spark:notify',
    'spark:emit',
    'spark:command',
    'input:text',
    'input:text:voice',
    'output:gen-ai:chat:message',
    'output:gen-ai:chat:complete',
    'output:gen-ai:chat:tool-call',
    'ui:configure',
  ]

  async function initialize(options?: { token?: string, possibleEvents?: Array<keyof WebSocketEvents> }) {
    if (connected.value && client.value)
      return Promise.resolve()
    if (initializing.value)
      return initializing.value

    const possibleEvents = Array.from(new Set<keyof WebSocketEvents>([
      ...basePossibleEvents,
      ...(options?.possibleEvents ?? []),
    ]))

    initializing.value = new Promise<void>((resolve, reject) => {
      const url = websocketUrl.value || defaultWebSocketUrl
      if (isStageTamagotchi() && !channelVsChatInfoLogged.value) {
        channelVsChatInfoLogged.value = true
        console.info(
          '[Channel] Tamagotchi connects to the extension channel (port 6121) to receive browser context. Chat uses HTTP to your brain gateway (e.g. port 18790).',
        )
      }
      // Tamagotchi must connect so it receives context:update from the Chrome extension (page, video, subtitles).
      // App.vue starts the WebSocket server before initializing the channel, so the server is ready.
      client.value = new Client({
        name: isStageWeb() ? WebSocketEventSource.StageWeb : isStageTamagotchi() ? WebSocketEventSource.StageTamagotchi : WebSocketEventSource.StageWeb,
        url,
        token: options?.token,
        possibleEvents,
        autoConnect: true,
        maxReconnectAttempts: -1,
        onAnyMessage: (event) => {
          useWebSocketInspectorStore().add('incoming', event)
        },
        onAnySend: (event) => {
          useWebSocketInspectorStore().add('outgoing', event)
        },
        onError: (error) => {
          connected.value = false
          initializing.value = null
          clearListeners()
          reject(error)
          if (!channelErrorHintLogged.value) {
            channelErrorHintLogged.value = true
            console.warn(
              'Channel WebSocket (port 6121) failed — used for extension/sync, not for chat. Chat uses the brain gateway over HTTP (Unichan port). If chat does not work: Save in Unichan settings, then set Settings → Consciousness → OpenClaw (Unichan brain).',
              error,
            )
          }
        },
        onClose: () => {
          connected.value = false
          initializing.value = null
          clearListeners()
          reject(new Error('WebSocket server connection closed'))
          if (!channelErrorHintLogged.value) {
            channelErrorHintLogged.value = true
            console.warn(
              'Channel WebSocket closed. This is the internal channel (extension/sync), not the brain. Chat uses HTTP to your Unichan gateway — ensure Save in Unichan and Consciousness → OpenClaw.',
            )
          }
        },
      })

      client.value.onEvent('module:authenticated', (event) => {
        if (event.data.authenticated) {
          connected.value = true
          flush()
          initializeListeners()
          resolve()

          // eslint-disable-next-line no-console
          console.log('WebSocket server connection established and authenticated')

          return
        }

        connected.value = false
      })

      // No auth token: server auto-authenticates on connect, so we'll get module:authenticated quickly.
      // With auth token: we must wait for module:authenticated after sending module:authenticate.
    })
  }

  async function ensureConnected() {
    await initializing.value
    if (!connected.value) {
      return await initialize()
    }
  }

  function clearListeners() {
    for (const disposer of listenerDisposers.value) {
      try {
        disposer()
      }
      catch (error) {
        console.warn('Failed to dispose channel listener:', error)
      }
    }
    listenerDisposers.value = []
    listenersInitialized.value = false
  }

  function initializeListeners() {
    if (!client.value)
      // No-op for now; keep placeholder for future shared listeners.
      // eslint-disable-next-line no-useless-return
      return
  }

  function send<C = undefined>(data: WebSocketEventOptionalSource<C>) {
    if (!client.value && !initializing.value)
      void initialize()

    if (client.value && connected.value) {
      client.value.send(data as WebSocketEvent)
    }
    else {
      pendingSend.value.push(data as WebSocketEvent)
    }
  }

  function flush() {
    if (client.value && connected.value) {
      for (const update of pendingSend.value) {
        client.value.send(update)
      }

      pendingSend.value = []
    }
  }

  function onContextUpdate(callback: (event: WebSocketBaseEvent<'context:update', ContextUpdate>) => void | Promise<void>) {
    if (!client.value && !initializing.value)
      void initialize()

    client.value?.onEvent('context:update', callback as any)

    return () => {
      client.value?.offEvent('context:update', callback as any)
    }
  }

  function onEvent<E extends keyof WebSocketEvents>(
    type: E,
    callback: (event: WebSocketBaseEvent<E, WebSocketEvents[E]>) => void | Promise<void>,
  ) {
    if (!client.value && !initializing.value)
      void initialize()

    client.value?.onEvent(type, callback as any)

    return () => {
      client.value?.offEvent(type, callback as any)
    }
  }

  function sendContextUpdate(message: Omit<ContextUpdate, 'id' | 'contextId'> & Partial<Pick<ContextUpdate, 'id' | 'contextId'>>) {
    const id = nanoid()
    send({ type: 'context:update', data: { id, contextId: id, ...message } })
  }

  function dispose() {
    flush()
    clearListeners()

    if (client.value) {
      client.value.close()
      client.value = undefined
    }
    connected.value = false
    initializing.value = null
  }

  watch(websocketUrl, (newUrl, oldUrl) => {
    if (newUrl === oldUrl)
      return

    if (client.value || initializing.value) {
      dispose()
      void initialize()
    }
  })

  return {
    connected,
    ensureConnected,

    initialize,
    send,
    sendContextUpdate,
    onContextUpdate,
    onEvent,
    dispose,
  }
})
