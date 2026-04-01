import { createRoot } from 'react-dom/client'
import { initTheme } from './lib/theme'
import App from './app'
import './tailwind.css'

initTheme()
createRoot(document.getElementById('root')!).render(<App />)
