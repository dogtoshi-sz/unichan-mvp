<script lang="ts" setup>
import type { PageContextPayload } from '../../../../src/shared/types'

defineProps<{
  syncing: boolean
  connected: boolean
  lastPage?: PageContextPayload
  sendPageContext?: boolean
}>()

const emit = defineEmits<{
  (event: 'refresh'): void
}>()
</script>

<template>
  <header :class="['flex', 'flex-col', 'gap-3']">
    <div :class="['flex', 'items-center', 'justify-between', 'gap-3']">
      <div :class="['flex', 'flex-col', 'gap-1']">
        <h1 :class="['text-lg', 'font-600', 'tracking-tight']">
          Unichan
        </h1>
        <p :class="['text-xs', 'opacity-70']">
          Screen context for Tamagotchi
        </p>
      </div>
    <div :class="['flex', 'items-center', 'gap-2']">
      <button
        :disabled="syncing"
        :class="['rounded-lg border-2 border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 p-2 transition hover:bg-neutral-200 dark:hover:bg-neutral-600', syncing ? 'opacity-60 cursor-not-allowed' : '']"
        @click="emit('refresh')"
      >
        <div :class="[syncing ? 'i-svg-spinners:ring-resize' : 'i-solar:refresh-linear', 'size-4']" />
      </button>
      <span :class="['px-2', 'py-1', 'rounded-full', 'text-xs', 'font-600', 'border', connected ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300']">
        {{ connected ? 'Connected' : 'Offline' }}
      </span>
    </div>
    </div>
    <div
      v-if="connected && sendPageContext && lastPage"
      :class="['rounded-lg', 'bg-neutral-200/50 dark:bg-neutral-700/50', 'border', 'border-neutral-300 dark:border-neutral-600', 'px-2', 'py-1.5', 'text-xs']"
    >
      <span :class="['font-500', 'opacity-80']">Current tab:</span>
      <span :class="['ml-1', 'truncate', 'block']" :title="lastPage.url">
        {{ lastPage.title || lastPage.url || 'Unknown' }}
      </span>
    </div>
  </header>
</template>
