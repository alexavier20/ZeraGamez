import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { App } from '@/app/App';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
