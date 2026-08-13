import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setDocumentTitle } from '../lib/i18n'
import Dashboard from './Dashboard'

setDocumentTitle((t) => `${t('appName')} — ${t('dashboardTitle')}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
)
