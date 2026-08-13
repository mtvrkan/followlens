import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setDocumentTitle } from '../lib/i18n'
import Options from './Options'

setDocumentTitle((t) => `${t('appName')} — ${t('settingsTitle')}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
)
