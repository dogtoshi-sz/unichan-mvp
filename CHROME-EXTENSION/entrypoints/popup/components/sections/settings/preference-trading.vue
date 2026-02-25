<script lang="ts" setup>
import { Button, FieldCheckbox, FieldInput } from '@proj-airi/ui'
import { computed } from 'vue'

const emit = defineEmits<{
  (event: 'apply'): void
}>()

const tradingEnabledModel = defineModel<boolean>('trading-enabled', { required: true })
const birdeyeApiKeyModel = defineModel<string>('birdeye-api-key', { required: true })
const whaleAlertThresholdModel = defineModel<number>('whale-alert-threshold', { required: true })

const whaleAlertThresholdStr = computed({
  get: () => String(whaleAlertThresholdModel.value ?? 1),
  set: (v) => { whaleAlertThresholdModel.value = Number(v) || 1 },
})

defineProps<{
  syncing: boolean
}>()
</script>

<template>
  <section :class="['rounded-2xl', 'bg-neutral-100 dark:bg-neutral-800/80', 'border-2', 'border-neutral-300 dark:border-neutral-600', 'p-3', 'flex', 'flex-col', 'gap-3']">
    <h2 :class="['text-sm', 'font-600']">
      Trading
    </h2>
    <FieldCheckbox v-model="tradingEnabledModel" label="Trading enabled (GMGN badges, pump.fun overlay)" />
    <FieldInput
      v-model="birdeyeApiKeyModel"
      label="BirdEye API Key"
      type="password"
      placeholder="Get key at birdeye.so"
    />
    <FieldInput
      v-model="whaleAlertThresholdStr"
      label="Whale alert threshold (SOL)"
      type="number"
      placeholder="1"
    />
    <Button variant="primary" size="sm" :disabled="syncing" @click="emit('apply')">
      Apply settings
    </Button>
  </section>
</template>
