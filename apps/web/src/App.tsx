import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoadingBlock } from './components/ui';
import { AccountingPage } from './pages/AccountingPage';
import { AttendanceLeavesPage } from './pages/AttendanceLeavesPage';
import { CustomersPage } from './pages/CustomersPage';
import { CrmPage } from './pages/CrmPage';
import { DashboardPage } from './pages/DashboardPage';
import { HrPage } from './pages/HrPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LoginPage } from './pages/LoginPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductionPage } from './pages/ProductionPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { ReportsPage } from './pages/ReportsPage';
import { StockPage } from './pages/StockPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { SalesOrdersPage } from './pages/SalesOrdersPage';

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
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/orders" element={<SalesOrdersPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/purchasing" element={<PurchaseOrdersPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/hr" element={<HrPage />} />
        <Route path="/attendance" element={<AttendanceLeavesPage />} />
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/production" element={<ProductionPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
