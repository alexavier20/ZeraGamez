import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppRouter } from '@/app/router';
import '@/styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('O elemento raiz da aplicação não foi encontrado.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
);
