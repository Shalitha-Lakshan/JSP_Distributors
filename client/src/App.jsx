import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ManagerDashboardPage from "./pages/ManagerDashboardPage";
import PosPage from "./pages/PosPage";
import ProductsPage from "./pages/ProductsPage";
import StockAddPage from "./pages/StockAddPage";
import StockBatchesPage from "./pages/StockBatchesPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerLedgerPage from "./pages/CustomerLedgerPage";
import PaymentsPage from "./pages/PaymentsPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import InvoicePage from "./pages/InvoicePage";
import DailyClosingPage from "./pages/DailyClosingPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import ProtectedRoute from "./components/ProtectedRoute";

const App = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route
      element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/dashboard/admin" element={<AdminDashboardPage />} />
      <Route path="/dashboard/manager" element={<ManagerDashboardPage />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/stock/add" element={<StockAddPage />} />
      <Route path="/stock/batches" element={<StockBatchesPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/customers/:id/ledger" element={<CustomerLedgerPage />} />
      <Route path="/payments" element={<PaymentsPage />} />
      <Route path="/sales" element={<SalesHistoryPage />} />
      <Route path="/invoices/:invoiceNo" element={<InvoicePage />} />
      <Route path="/reports/daily-closing" element={<DailyClosingPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <UsersPage />
          </ProtectedRoute>
        }
      />
    </Route>
  </Routes>
);

export default App;
