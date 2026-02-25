import type { ExtensionSettings, ExtensionStatus } from './types'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

export const popupGetStatus = defineInvokeEventa<ExtensionStatus>('eventa:invoke:web-extension:popup:get-status')
export const popupUpdateSettings = defineInvokeEventa<ExtensionStatus, Partial<ExtensionSettings>>('eventa:invoke:web-extension:popup:update-settings')
export const popupToggleEnabled = defineInvokeEventa<ExtensionStatus, boolean>('eventa:invoke:web-extension:popup:toggle-enabled')
export const popupReconnect = defineInvokeEventa<ExtensionStatus>('eventa:invoke:web-extension:popup:reconnect')
export const popupRequestCurrentTabContext = defineInvokeEventa<void>('eventa:invoke:web-extension:popup:request-current-tab-context')
export const popupRequestVisionFrame = defineInvokeEventa<ExtensionStatus>('eventa:invoke:web-extension:popup:request-vision-frame')
export const popupClearError = defineInvokeEventa<ExtensionStatus>('eventa:invoke:web-extension:popup:clear-error')

export const backgroundStatusChanged = defineEventa<ExtensionStatus>('eventa:event:web-extension:background:status')
