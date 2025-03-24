import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@frontend/src/app'

export default function triggerMain() {
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
}
