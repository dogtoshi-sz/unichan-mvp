import type { VRMIdlePoseKey } from '@proj-airi/stage-ui-three/assets/vrm'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export const useSettingsVrm = defineStore('settings-vrm', () => {
  const vrmIdlePose = useLocalStorageManualReset<VRMIdlePoseKey>('settings/vrm/idle-pose', 'idleLoop')

  function resetState() {
    vrmIdlePose.reset()
  }

  return {
    vrmIdlePose,
    resetState,
  }
})
