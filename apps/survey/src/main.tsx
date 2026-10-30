import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getSurvey } from './surveys';
import '@fontsource-variable/inter';
import '@fontsource-variable/work-sans';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App survey={getSurvey(import.meta.env.VITE_SURVEY)} />
  </StrictMode>,
);
