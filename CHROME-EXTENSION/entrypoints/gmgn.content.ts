import '../src/content/gmgn.css'
import '../src/content/gmgn'

export default defineContentScript({
  matches: ['https://gmgn.ai/*'],
  runAt: 'document_idle',
  main() {
    // gmgn.ts runs on import (MutationObserver, scanRows)
  },
})
