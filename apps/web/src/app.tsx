import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/auth-context';
import { permissionForRoute } from './auth/route-permissions';
import { RequirePermission } from './auth/require-permission';
import { Layout } from './components/layout';
import { ErrorBoundary } from './components/error-boundary';
import { LoadingBlock } from './components/ui';

function lazyPage<T extends Record<string, ComponentType>>(
  loader: () => Promise<T>,
  exportName: keyof T,
): React.LazyExoticComponent<ComponentType> {
  return lazy(async () => ({ default: (await loader())[exportName] }));
}

const AccountingPage = lazyPage(() => import('./pages/accounting-page'), 'AccountingPage');
const AcceptInvitePage = lazyPage(
  () => import('./pages/accept-invite-page'),
  'AcceptInvitePage',
);
const AttendanceLeavesPage = lazyPage(
  () => import('./pages/attendance-leaves-page'),
  'AttendanceLeavesPage',
);
const AuditPage = lazyPage(() => import('./pages/audit-page'), 'AuditPage');
const ChartAccountsPage = lazyPage(() => import('./pages/chart-accounts-page'), 'ChartAccountsPage');
const CustomersPage = lazyPage(() => import('./pages/customers-page'), 'CustomersPage');
const CrmPage = lazyPage(() => import('./pages/crm-page'), 'CrmPage');
const DashboardPage = lazyPage(() => import('./pages/dashboard-page'), 'DashboardPage');
const ForgotPasswordPage = lazyPage(
  () => import('./pages/forgot-password-page'),
  'ForgotPasswordPage',
);
const HrPage = lazyPage(() => import('./pages/hr-page'), 'HrPage');
const InvoicesPage = lazyPage(() => import('./pages/invoices-page'), 'InvoicesPage');
const LoginPage = lazyPage(() => import('./pages/login-page'), 'LoginPage');
const ProductsPage = lazyPage(() => import('./pages/products-page'), 'ProductsPage');
const ProductionPage = lazyPage(() => import('./pages/production-page'), 'ProductionPage');
const ProfilePage = lazyPage(() => import('./pages/profile-page'), 'ProfilePage');
const PurchaseOrdersPage = lazyPage(
  () => import('./pages/purchase-orders-page'),
  'PurchaseOrdersPage',
);
const PosPage = lazyPage(() => import('./pages/pos-page'), 'PosPage');
const ReportsPage = lazyPage(() => import('./pages/reports-page'), 'ReportsPage');
const ResetPasswordPage = lazyPage(
  () => import('./pages/reset-password-page'),
  'ResetPasswordPage',
);
const StockPage = lazyPage(() => import('./pages/stock-page'), 'StockPage');
const SuppliersPage = lazyPage(() => import('./pages/suppliers-page'), 'SuppliersPage');
const UsersRolesPage = lazyPage(() => import('./pages/users-roles-page'), 'UsersRolesPage');
const WarehousesCategoriesPage = lazyPage(
  () => import('./pages/warehouses-categories-page'),
  'WarehousesCategoriesPage',
);
const SalesOrdersPage = lazyPage(() => import('./pages/sales-orders-page'), 'SalesOrdersPage');
const SettingsPage = lazyPage(() => import('./pages/settings-page'), 'SettingsPage');
const ForbiddenPage = lazyPage(() => import('./pages/forbidden-page'), 'ForbiddenPage');
const NotFoundPage = lazyPage(() => import('./pages/not-found-page'), 'NotFoundPage');

function GuardedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <RequirePermission permission={permissionForRoute(location.pathname)}>{children}</RequirePermission>
  );
}

function ProtectedLayout() {
  const { user, initializing } = useAuth();
  if (initializing) {
    return <LoadingBlock full />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingBlock full />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<GuardedRoute><DashboardPage /></GuardedRoute>} />
            <Route path="/pos" element={<GuardedRoute><PosPage /></GuardedRoute>} />
            <Route path="/products" element={<GuardedRoute><ProductsPage /></GuardedRoute>} />
            <Route path="/stock" element={<GuardedRoute><StockPage /></GuardedRoute>} />
            <Route path="/warehouses" element={<GuardedRoute><WarehousesCategoriesPage /></GuardedRoute>} />
            <Route path="/invoices" element={<GuardedRoute><InvoicesPage /></GuardedRoute>} />
            <Route path="/customers" element={<GuardedRoute><CustomersPage /></GuardedRoute>} />
            <Route path="/orders" element={<GuardedRoute><SalesOrdersPage /></GuardedRoute>} />
            <Route path="/suppliers" element={<GuardedRoute><SuppliersPage /></GuardedRoute>} />
            <Route path="/purchasing" element={<GuardedRoute><PurchaseOrdersPage /></GuardedRoute>} />
            <Route path="/accounting" element={<GuardedRoute><AccountingPage /></GuardedRoute>} />
            <Route path="/accounts" element={<GuardedRoute><ChartAccountsPage /></GuardedRoute>} />
            <Route path="/hr" element={<GuardedRoute><HrPage /></GuardedRoute>} />
            <Route path="/attendance" element={<GuardedRoute><AttendanceLeavesPage /></GuardedRoute>} />
            <Route path="/crm" element={<GuardedRoute><CrmPage /></GuardedRoute>} />
            <Route path="/production" element={<GuardedRoute><ProductionPage /></GuardedRoute>} />
            <Route path="/reports" element={<GuardedRoute><ReportsPage /></GuardedRoute>} />
            <Route path="/users-roles" element={<GuardedRoute><UsersRolesPage /></GuardedRoute>} />
            <Route path="/audit" element={<GuardedRoute><AuditPage /></GuardedRoute>} />
            <Route path="/settings" element={<GuardedRoute><SettingsPage /></GuardedRoute>} />
            <Route path="/profile" element={<GuardedRoute><ProfilePage /></GuardedRoute>} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
