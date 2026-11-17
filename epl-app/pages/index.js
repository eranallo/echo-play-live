// The bare address has no sign-in; everyone uses their personal link.
import Head from 'next/head'

export default function Landing() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, background:'#0a0a0f', padding:24, textAlign:'center' }}>
      <Head><title>Echo Play Live</title></Head>
      <img src="/logo.png" alt="Echo Play Live" style={{ width:120, height:120, objectFit:'contain', mixBlendMode:'screen' }} />
      <div style={{ fontSize:17, fontWeight:700, color:'#ffffff' }}>Echo Play Live</div>
      <div style={{ fontSize:14, color:'#9ca3af', maxWidth:340, lineHeight:1.6 }}>
        Open the personal link Evan sent you to see your shows. Then add it to your home screen so it's one tap away.
      </div>
    </div>
  )
}
