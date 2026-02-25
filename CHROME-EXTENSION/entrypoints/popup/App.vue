<script lang="ts" setup>
import { Button, Callout } from '@proj-airi/ui'
import { onMounted } from 'vue'

import {
  HeaderPopup,
  PreferenceCapture,
  PreferenceTrading,
  SettingsConnection,
  VisualizeLiveVision,
} from './components'
import { usePopupStore } from './stores'

const popup = usePopupStore()

onMounted(() => popup.init())
</script>

<template>
  <main :class="['flex', 'flex-col', 'gap-4', 'w-full']">
    <HeaderPopup
      :syncing="popup.syncing.value"
      :connected="popup.connected.value"
      :last-page="popup.status.value?.lastPage"
      :send-page-context="popup.form.sendPageContext"
      @refresh="popup.refresh"
    />

    <Callout v-if="popup.lastError.value" theme="orange" label="Connection error">
      <div :class="['flex', 'flex-col', 'gap-2']">
        <div :class="['flex', 'items-start', 'gap-2']">
          <div :class="['flex-1', 'text-xs', 'leading-snug', 'opacity-80']">
            {{ popup.lastError.value }}
          </div>
          <Button variant="danger" size="sm" @click="popup.clearLastError">
            Clear
          </Button>
        </div>
        <p :class="['text-xs', 'opacity-70', 'mt-1']">
          Make sure <strong>Tamagotchi</strong> is running. The extension connects to Tamagotchi at <code>ws://localhost:6121/ws</code>, not to the brain directly.
        </p>
      </div>
    </Callout>

    <PreferenceCapture
      v-model:send-page-context="popup.form.sendPageContext"
      v-model:send-video-context="popup.form.sendVideoContext"
      v-model:send-subtitles="popup.form.sendSubtitles"
      v-model:send-spark-notify="popup.form.sendSparkNotify"
      v-model:enable-vision="popup.form.enableVision"
      @capture="popup.captureFrame"
    />

    <VisualizeLiveVision :last-video="popup.lastVideo.value" :last-subtitle="popup.lastSubtitle.value" />

    <PreferenceTrading
      v-model:trading-enabled="popup.form.tradingEnabled"
      v-model:birdeye-api-key="popup.form.birdeyeApiKey"
      v-model:whale-alert-threshold="popup.form.whaleAlertThresholdSol"
      :syncing="popup.syncing.value"
      @apply="popup.applySettings"
    />

    <SettingsConnection
      v-model:ws-url="popup.form.wsUrl"
      v-model:token="popup.form.token"
      :enabled="popup.form.enabled"
      :syncing="popup.syncing.value"
      :connected="popup.connected.value"
      @toggle="popup.toggle"
      @apply="popup.applySettings"
      @reconnect="popup.reconnectNow"
    />
  </main>
</template>
