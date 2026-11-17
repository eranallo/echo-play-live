// A person's own app: /m/<token>. The token in the address is the sign-in,
// so this is the address people add to their home screen.
import { useRouter } from 'next/router'
import EplApp from '../../components/EplApp'

export default function PersonalApp() {
  const router = useRouter()
  // Dynamic route params arrive after hydration.
  if (!router.isReady) return null
  const raw = router.query.token
  const token = Array.isArray(raw) ? raw[0] : raw
  return <EplApp key={token} token={token} />
}
