import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { HomePage } from '@/pages/HomePage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
