import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Atkinson Hyperlegible Next, made for low vision. Bundled so it works offline.
import '@fontsource/atkinson-hyperlegible-next/latin-400.css';
import '@fontsource/atkinson-hyperlegible-next/latin-700.css';
import '@fontsource/atkinson-hyperlegible-next/latin-800.css';
import './styles.css';
// Keeps the app's own code up to date, reloading only at a safe moment.
import './update';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
