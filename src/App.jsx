import { lazy, Suspense, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AdminAuthProvider, AdminAuthContext } from "./context/AdminAuthContext";
import { Navbar, BottomNav } from "./components/Navbar";

const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ProductListPage = lazy(() => import("./pages/ProductListPage"));
const AddProductPage = lazy(() => import("./pages/AddProductPage"));
const EditProductPage = lazy(() => import("./pages/EditProductPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));

const AdminPrivateRoute = ({ children }) => {
  const context = useContext(AdminAuthContext);

  if (!context) {
    return <Navigate to="/admin-login" replace />;
  }

  if (context.loading) {
    return <PageLoading />;
  }

  const { isAdmin } = context;

  if (!isAdmin) {
    return <Navigate to="/admin-login" replace />;
  }

  return children;
};

const PageLoading = () => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 font-nunito text-agriGreen">
    <div
      className="h-10 w-10 animate-spin rounded-full border-2 border-agriGreen border-t-transparent"
      aria-hidden
    />
    <p className="text-sm font-semibold">Loading…</p>
  </div>
);

const AppLayout = ({ children }) => {
  const context = useContext(AdminAuthContext);
  const isAdminLoggedIn = Boolean(context?.isAdmin);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-agriCream via-white to-agriCream">
      {isAdminLoggedIn && (
        <>
          <Navbar />
          <BottomNav />
        </>
      )}
      <main
        className={`page-fade-in w-full max-w-full overflow-x-hidden ${isAdminLoggedIn
          ? "pt-[calc(4rem+env(safe-area-inset-top,0px))] px-3 sm:px-4 py-4 md:py-6 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8"
          : ""
          }`}
      >
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <AppLayout>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/admin-login" element={<AdminLoginPage />} />

              <Route
                path="/"
                element={
                  <AdminPrivateRoute>
                    <HomePage />
                  </AdminPrivateRoute>
                }
              />
              <Route
                path="/add"
                element={
                  <AdminPrivateRoute>
                    <AddProductPage />
                  </AdminPrivateRoute>
                }
              />
              <Route
                path="/products"
                element={
                  <AdminPrivateRoute>
                    <ProductListPage />
                  </AdminPrivateRoute>
                }
              />
              <Route
                path="/edit/:id"
                element={
                  <AdminPrivateRoute>
                    <EditProductPage />
                  </AdminPrivateRoute>
                }
              />
              <Route
                path="/product/:id"
                element={
                  <AdminPrivateRoute>
                    <ProductDetailPage />
                  </AdminPrivateRoute>
                }
              />
              <Route
                path="/report"
                element={
                  <AdminPrivateRoute>
                    <HomePage />
                  </AdminPrivateRoute>
                }
              />
              <Route
                path="/invoices"
                element={
                  <AdminPrivateRoute>
                    <InvoicesPage />
                  </AdminPrivateRoute>
                }
              />
              <Route
                path="/customers"
                element={
                  <AdminPrivateRoute>
                    <CustomersPage />
                  </AdminPrivateRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
        <Toaster
          position="top-center"
          containerStyle={{
            top: "calc(0.75rem + env(safe-area-inset-top, 0px) + 4rem)",
          }}
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: "max(16px, 1rem)",
              fontFamily: "Nunito, sans-serif",
              fontWeight: "500",
              maxWidth: "min(100vw - 2rem, 24rem)",
            },
            success: {
              style: {
                background: "#2D6A4F",
                color: "#FFFFFF",
              },
              iconTheme: {
                primary: "#FFFFFF",
                secondary: "#2D6A4F",
              },
            },
            error: {
              style: {
                background: "#C0392B",
                color: "#FFFFFF",
              },
              iconTheme: {
                primary: "#FFFFFF",
                secondary: "#C0392B",
              },
            },
          }}
        />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default App;
