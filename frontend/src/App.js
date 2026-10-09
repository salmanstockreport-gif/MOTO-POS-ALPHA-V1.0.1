import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Items from "@/pages/Items";
import Hsn from "@/pages/Hsn";
import Parties from "@/pages/Parties";
import PartyLedger from "@/pages/PartyLedger";
import Purchases from "@/pages/Purchases";
import Invoices from "@/pages/Invoices";
import InvoiceView from "@/pages/InvoiceView";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import GstReport from "@/pages/GstReport";

function Protected({ children, admin }) {
  const { user, isAdmin } = useAuth();
  if (user === null)
    return <div className="min-h-screen grid place-items-center label-xs" data-testid="auth-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="pos" element={<POS />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="invoices/:id" element={<InvoiceView />} />
              <Route path="items" element={<Items />} />
              <Route path="hsn" element={<Hsn />} />
              <Route path="customers" element={<Parties ptype="customer" />} />
              <Route path="customers/:id" element={<PartyLedger ptype="customer" />} />
              <Route path="suppliers" element={<Protected admin><Parties ptype="supplier" /></Protected>} />
              <Route path="suppliers/:id" element={<Protected admin><PartyLedger ptype="supplier" /></Protected>} />
              <Route path="purchases" element={<Protected admin><Purchases /></Protected>} />
              <Route path="gst-report" element={<Protected admin><GstReport /></Protected>} />
              <Route path="users" element={<Protected admin><Users /></Protected>} />
              <Route path="settings" element={<Protected admin><Settings /></Protected>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
