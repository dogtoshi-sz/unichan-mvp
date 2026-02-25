import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useInlineChatStore = defineStore('inline-chat', () => {
  const showInlineChat = ref(false)

  function toggle() {
    showInlineChat.value = !showInlineChat.value
  }

  function open() {
    showInlineChat.value = true
  }

  function close() {
    showInlineChat.value = false
  }

  return {
    showInlineChat,
    toggle,
    open,
    close,
  }
})
