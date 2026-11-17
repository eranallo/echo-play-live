// The bare address has no sign-in; everyone uses their personal link.
import Head from 'next/head'
import { Seal } from '../components/ui'

export default function Landing() {
  return (
    <main className="center-screen">
      <Head><title>Echo Play Live</title></Head>
      <Seal />
      <h1>Echo Play Live</h1>
      <p>Open the personal link Evan sent you to see your shows. Then add it to your home screen so it's one tap away.</p>
    </main>
  )
}
