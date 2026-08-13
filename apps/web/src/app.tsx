import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/auth-context';
import { Layout } from './components/layout';
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

function ProtectedLayout() {
  const { user, initializing } = useAuth();
  if (initializing) {
    return <LoadingBlock />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/warehouses" element={<WarehousesCategoriesPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/orders" element={<SalesOrdersPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/purchasing" element={<PurchaseOrdersPage />} />
          <Route path="/accounting" element={<AccountingPage />} />
          <Route path="/accounts" element={<ChartAccountsPage />} />
          <Route path="/hr" element={<HrPage />} />
          <Route path="/attendance" element={<AttendanceLeavesPage />} />
          <Route path="/crm" element={<CrmPage />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users-roles" element={<UsersRolesPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
