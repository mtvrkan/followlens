import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setDocumentTitle } from '../lib/i18n'
import Onboarding from './Onboarding'

// Already a full sentence in every catalog, so it stands alone rather than
// being composed into the "Brand — Section" shape the other pages use.
setDocumentTitle((t) => t('onboardingTitle'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Onboarding />
  </StrictMode>,
)
