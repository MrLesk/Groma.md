import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@xyflow/react/dist/style.css'
import './styles.css'
import { ViewerApp } from './viewer-app.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ViewerApp />
  </StrictMode>,
)
