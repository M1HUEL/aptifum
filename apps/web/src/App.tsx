import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoadingBlock } from './components/ui';

function lazyPage<T extends Record<string, ComponentType>>(
  loader: () => Promise<T>,
  exportName: keyof T,
): React.LazyExoticComponent<ComponentType> {
  return lazy(async () => ({ default: (await loader())[exportName] }));
}

const AccountingPage = lazyPage(() => import('./pages/AccountingPage'), 'AccountingPage');
const AttendanceLeavesPage = lazyPage(
  () => import('./pages/AttendanceLeavesPage'),
  'AttendanceLeavesPage',
);
const AuditPage = lazyPage(() => import('./pages/AuditPage'), 'AuditPage');
const ChartAccountsPage = lazyPage(() => import('./pages/ChartAccountsPage'), 'ChartAccountsPage');
const CustomersPage = lazyPage(() => import('./pages/CustomersPage'), 'CustomersPage');
const CrmPage = lazyPage(() => import('./pages/CrmPage'), 'CrmPage');
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');
const HrPage = lazyPage(() => import('./pages/HrPage'), 'HrPage');
const InvoicesPage = lazyPage(() => import('./pages/InvoicesPage'), 'InvoicesPage');
const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage');
const ProductsPage = lazyPage(() => import('./pages/ProductsPage'), 'ProductsPage');
const ProductionPage = lazyPage(() => import('./pages/ProductionPage'), 'ProductionPage');
const PurchaseOrdersPage = lazyPage(
  () => import('./pages/PurchaseOrdersPage'),
  'PurchaseOrdersPage',
);
const ReportsPage = lazyPage(() => import('./pages/ReportsPage'), 'ReportsPage');
const StockPage = lazyPage(() => import('./pages/StockPage'), 'StockPage');
const SuppliersPage = lazyPage(() => import('./pages/SuppliersPage'), 'SuppliersPage');
const UsersRolesPage = lazyPage(() => import('./pages/UsersRolesPage'), 'UsersRolesPage');
const WarehousesCategoriesPage = lazyPage(
  () => import('./pages/WarehousesCategoriesPage'),
  'WarehousesCategoriesPage',
);
const SalesOrdersPage = lazyPage(() => import('./pages/SalesOrdersPage'), 'SalesOrdersPage');

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
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
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
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
