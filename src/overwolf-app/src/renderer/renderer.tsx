import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '@frontend/src/app'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to load root element. ')

const root = createRoot(rootElement)
root.render(
    <React.StrictMode>
    <App/>
    </React.StrictMode>
)