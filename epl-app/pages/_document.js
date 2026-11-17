import { Html, Head, Main, NextScript } from 'next/document'

// Applies the member's chosen theme before first paint, so someone who picked
// dark never sees a white flash walking into a dark venue. Light is the default.
const themeScript = `try{var t=localStorage.getItem("epl-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);if(t==="dark"){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#11191d")}}}catch(e){}`

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="theme-color" content="#f5f0e8" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
