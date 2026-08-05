import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { ReleasesPage } from '@/pages/ReleasesPage';
import { headerRoutes } from '@/shared/components/header/header.config';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path={headerRoutes.releases} element={<ReleasesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
