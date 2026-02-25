import '../src/content/gmgn.css'
import '../src/content/pumpfun'

export default defineContentScript({
  matches: ['https://pump.fun/*'],
  runAt: 'document_idle',
  main() {
    // pumpfun.ts runs on import
  },
})
