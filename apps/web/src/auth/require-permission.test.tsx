import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequirePermission } from './require-permission';

vi.mock('./auth-context', () => ({
  usePermission: () => (permission: string) => permission === 'allowed-permission',
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/"
          element={
            <RequirePermission permission="allowed-permission">
              <div>Allowed content</div>
            </RequirePermission>
          }
        />
        <Route
          path="/other"
          element={
            <RequirePermission permission="forbidden-permission">
              <div>Forbidden content</div>
            </RequirePermission>
          }
        />
        <Route path="/403" element={<div>Forbidden page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequirePermission', () => {
  it('renders children when the permission is granted', () => {
    renderAt('/');
    expect(screen.getByText('Allowed content')).toBeInTheDocument();
    expect(screen.queryByText('Forbidden page')).not.toBeInTheDocument();
  });

  it('redirects to /403 when the permission is missing', () => {
    renderAt('/other');
    expect(screen.getByText('Forbidden page')).toBeInTheDocument();
    expect(screen.queryByText('Forbidden content')).not.toBeInTheDocument();
  });
});
