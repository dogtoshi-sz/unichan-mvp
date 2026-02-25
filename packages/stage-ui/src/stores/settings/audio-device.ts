import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { onMounted, watch } from 'vue'

import { useAudioDevice } from '../audio'

export const useSettingsAudioDevice = defineStore('settings-audio-devices', () => {
  const { audioInputs, deviceConstraints, selectedAudioInput: selectedAudioInputNonPersist, startStream, stopStream, stream, askPermission } = useAudioDevice()

  const selectedAudioInputPersist = useLocalStorageManualReset<string>('settings/audio/input', selectedAudioInputNonPersist.value)
  const selectedAudioInputEnabledPersist = useLocalStorageManualReset<boolean>('settings/audio/input/enabled', true)

  watch(selectedAudioInputPersist, (newValue) => {
    selectedAudioInputNonPersist.value = newValue
    // When device changes and mic is enabled, restart stream so the new device is used (e.g. after syncing from Settings window)
    if (selectedAudioInputEnabledPersist.value) {
      stopStream()
      askPermission().then(() => {
        const list = audioInputs.value
        const current = selectedAudioInputPersist.value
        const isValid = current && list.some(d => d.deviceId === current)
        if (!isValid && list.length > 0) {
          const fallback = list.find(d => d.deviceId === 'default')?.deviceId || list[0].deviceId
          selectedAudioInputPersist.value = fallback
        }
        startStream()
      }).catch((err) => {
        console.error('[Settings Audio] Failed to apply new device:', err)
      })
    }
  })

  watch(selectedAudioInputEnabledPersist, (val) => {
    if (val) {
      // Ensure device list is loaded and selected device is still valid (avoid stale ID → mic not picked up)
      askPermission().then(() => {
        const list = audioInputs.value
        const current = selectedAudioInputPersist.value
        const isValid = current && list.some(d => d.deviceId === current)
        if (!isValid && list.length > 0) {
          const fallback = list.find(d => d.deviceId === 'default')?.deviceId || list[0].deviceId
          selectedAudioInputPersist.value = fallback
        }
        startStream()
      }).catch((err) => {
        console.error('[Settings Audio] Failed to prepare mic:', err)
      })
    }
    else {
      stopStream()
    }
  })

  onMounted(() => {
    const list = audioInputs.value
    const current = selectedAudioInputPersist.value
    const hasSelectedInput = current && list.some(device => device.deviceId === current)
    // If mic is enabled but stored device is missing/invalid, fall back to first or default so stream can start
    if (selectedAudioInputEnabledPersist.value && list.length > 0 && !hasSelectedInput) {
      selectedAudioInputPersist.value = list.find(d => d.deviceId === 'default')?.deviceId || list[0].deviceId
    }
    if (selectedAudioInputEnabledPersist.value && (hasSelectedInput || list.length > 0)) {
      startStream()
    }
    if (selectedAudioInputNonPersist.value && !selectedAudioInputEnabledPersist.value) {
      selectedAudioInputPersist.value = selectedAudioInputNonPersist.value
    }
  })

  function resetState() {
    selectedAudioInputPersist.reset()
    selectedAudioInputNonPersist.value = ''
    selectedAudioInputEnabledPersist.reset()
    stopStream()
  }

  return {
    audioInputs,
    deviceConstraints,
    selectedAudioInput: selectedAudioInputPersist,
    enabled: selectedAudioInputEnabledPersist,

    stream,

    askPermission,
    startStream,
    stopStream,
    resetState,
  }
})
