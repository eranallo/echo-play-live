// What every screen can reach without threading props through each layer:
// the loaded data and its index, who is signed in, the API helper (which
// carries the personal-link token), navigation, reload and a toast.
import { createContext, useContext } from 'react'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)
