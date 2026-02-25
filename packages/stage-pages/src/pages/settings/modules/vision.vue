<script setup lang="ts">
import { FieldCheckbox } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'

const { t } = useI18n()
const visionStore = useVisionStore()
const { includeBrowserScreenshot } = storeToRefs(visionStore)
</script>

<template>
  <div bg="neutral-50 dark:[rgba(0,0,0,0.3)]" rounded-xl p-4 flex="~ col gap-4">
    <p class="text-neutral-600 dark:text-neutral-400">
      {{ t('settings.pages.modules.vision.description') }}
    </p>
    <section class="flex flex-col gap-2">
      <h3 class="text-sm font-600 text-neutral-700 dark:text-neutral-300">
        {{ t('settings.pages.modules.vision.how-to-use') }}
      </h3>
      <p class="text-sm text-neutral-600 dark:text-neutral-400">
        {{ t('settings.pages.modules.vision.how-to-use-steps') }}
      </p>
    </section>
    <FieldCheckbox
      v-model="includeBrowserScreenshot"
      :label="t('settings.pages.modules.vision.include-browser-screenshot')"
      :description="t('settings.pages.modules.vision.include-browser-screenshot-description')"
    />
    <p class="text-sm text-neutral-500 dark:text-neutral-500">
      {{ t('settings.pages.modules.vision.extension-hint') }}
    </p>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.vision.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>
