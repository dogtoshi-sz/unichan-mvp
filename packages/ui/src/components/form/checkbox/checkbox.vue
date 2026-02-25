<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const modelValue = defineModel<boolean>({ required: true })
</script>

<template>
  <SwitchRoot
    v-model="modelValue"
    :class="[
      'duration-250 ease-in-out',
      'focus-within:outline-none',
      'flex',
      'is-interacting',
      'border-2 border-neutral-400 dark:border-neutral-500 data-[state=checked]:border-primary-300 dark:data-[state=checked]:border-primary-500 data-[state=unchecked]:border-neutral-400 dark:data-[state=unchecked]:border-neutral-500 focus-within:border-primary-500 dark:focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-300/30 dark:focus-within:ring-primary-500/30',
      'data-[state=checked]:bg-primary-400 data-[state=unchecked]:bg-neutral-300 data-[state=checked]:dark:bg-primary-400/80 dark:data-[state=unchecked]:bg-neutral-800',
      'relative h-7 w-12.5 rounded-full',
      'shadow-sm focus-within:shadow-none',
    ]"
  >
    <SwitchThumb
      :class="[
        'my-auto size-6',
        'flex items-center justify-center',
        'translate-x-0.5 data-[state=checked]:translate-x-full',
        'rounded-full bg-white text-xs',
        'transition-transform duration-250 ease-in-out',
        'will-change-transform',
      ]"
    />
  </SwitchRoot>
</template>
