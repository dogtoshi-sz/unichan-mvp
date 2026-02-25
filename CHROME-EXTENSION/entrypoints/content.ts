import { startContentObserver } from '../src/content'

export default defineContentScript({
  matches: [
    'https://*/*',
    'http://*/*',
  ],
  runAt: 'document_idle',
  main() {
    startContentObserver()
    // Character widget removed: extension only sends browser/screen context to desktop Tamagotchi.
  },
})
