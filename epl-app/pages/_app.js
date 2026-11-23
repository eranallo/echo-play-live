import '../styles/globals.css'
import { useEffect } from 'react'
import Head from 'next/head'

const SHELL_CACHE = 'epl-shell-v1' // the same name as in public/sw.js

// Install the service worker (public/sw.js) so the app opens with no signal,
// then save the files this visit already loaded, so the very next offline
// open works too.
function useOfflineShell() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        if (!window.caches) return
        const mine = (u) => { try { const x = new URL(u, location.href); return x.origin === location.origin && /^\/(_next\/static|fonts|brand)\//.test(x.pathname) } catch { return false } }
        const files = performance.getEntriesByType('resource').map(e => e.name).filter(mine)
        return caches.open(SHELL_CACHE).then(c => c.addAll([...new Set([location.pathname, ...files])]))
      })
      .catch(() => {})
  }, [])
}

export default function App({ Component, pageProps }) {
  useOfflineShell()
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" href="/brand/epl-seal-black.svg" type="image/svg+xml" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* "default" lets iOS colour the status bar from theme-color and pick
            readable text for it; black-translucent forces white text, which
            disappears on the light theme. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Echo Play Live" />
        {/* Personal links carry a sign-in token in the address: never send it
            to other sites as a referrer, and keep the app out of search. */}
        <meta name="referrer" content="no-referrer" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
