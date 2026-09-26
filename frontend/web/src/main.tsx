import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { initI18n } from './i18n';
import './styles/index.css';

/**
 * MSW mocks (docs/api-contracts.md). import.meta.env.DEV is statically false in production
 * builds, so this branch and the dynamic import are removed and no mock code is emitted.
 */
const enableMocking = async (): Promise<void> => {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
    const { startMockWorker } = await import('./mocks/browser');
    await startMockWorker();
  }
};

initI18n();

void enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
