import { createContext } from 'react'

// The API owns the HttpOnly cookie. React holds the public user profile.
export const AuthContext = createContext(null)
