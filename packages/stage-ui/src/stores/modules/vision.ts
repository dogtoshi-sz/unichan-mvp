import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export const useVisionStore = defineStore('vision', () => {
  /** When true, the next chat send will include the latest browser screenshot from the Chrome extension (if any) as an image attachment. */
  const includeBrowserScreenshot = useLocalStorageManualReset<boolean>('settings/vision/include-browser-screenshot', true)

  return {
    includeBrowserScreenshot,
  }
})
