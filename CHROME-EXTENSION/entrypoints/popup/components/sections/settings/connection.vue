<script lang="ts" setup>
import { Button, FieldInput } from '@proj-airi/ui'

defineProps<{
  enabled: boolean
  syncing: boolean
  connected: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle'): void
  (event: 'apply'): void
  (event: 'reconnect'): void
}>()
const wsUrlModel = defineModel<string>('ws-url', { required: true })
const tokenModel = defineModel<string>('token', { required: true })
</script>

<template>
  <section :class="['rounded-2xl', 'bg-neutral-100 dark:bg-neutral-800/80', 'border-2', 'border-neutral-300 dark:border-neutral-600', 'p-3', 'flex', 'flex-col', 'gap-3']">
    <div :class="['flex', 'items-center', 'justify-between']">
      <h2 :class="['text-sm', 'font-600']">
        Connection
      </h2>
      <div :class="['flex', 'items-center', 'gap-2']">
        <Button
          v-if="enabled && !connected"
          variant="primary"
          size="sm"
          :disabled="syncing"
          @click="emit('reconnect')"
        >
          {{ syncing ? 'Connecting…' : 'Connect' }}
        </Button>
        <Button
          v-else-if="enabled && connected"
          variant="secondary"
          size="sm"
          :disabled="syncing"
          @click="emit('reconnect')"
        >
          Reconnect
        </Button>
        <Button variant="secondary" size="sm" @click="emit('toggle')">
          {{ enabled ? 'Disable' : 'Enable' }}
        </Button>
      </div>
    </div>
    <FieldInput v-model="wsUrlModel" label="WebSocket URL" placeholder="ws://localhost:6121/ws" />
    <FieldInput v-model="tokenModel" label="Access Token" placeholder="optional" />
    <Button variant="primary" size="sm" :disabled="syncing" @click="emit('apply')">
      Apply settings
    </Button>
  </section>
</template>
