import type { ExtensionStatus } from '../shared/types'

import { defineInvoke } from '@moeru/eventa'

import { backgroundStatusChanged, popupClearError, popupGetStatus, popupReconnect, popupRequestCurrentTabContext, popupRequestVisionFrame, popupToggleEnabled, popupUpdateSettings } from '../shared/eventa'
import { createRuntimeEventaContext } from '../shared/eventa-runtime'

const { context } = createRuntimeEventaContext()

export const requestStatus = defineInvoke(context, popupGetStatus)
export const updateSettings = defineInvoke(context, popupUpdateSettings)
export const toggleEnabled = defineInvoke(context, popupToggleEnabled)
export const reconnect = defineInvoke(context, popupReconnect)
export const requestCurrentTabContext = defineInvoke(context, popupRequestCurrentTabContext)
export const requestVisionFrame = defineInvoke(context, popupRequestVisionFrame)
export const clearError = defineInvoke(context, popupClearError)

export function onBackgroundStatus(callback: (status: ExtensionStatus) => void) {
  const off = context.on(backgroundStatusChanged, (event) => {
    callback(event.body!)
  })

  return () => off()
}
