import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import './index.css'
import { AppProvider, useApp } from './lib/app'
import { CustomerDetail, CustomerList, VehicleDetail } from './pages/Customers'
import Dashboard from './pages/Dashboard'
import DocEditor from './pages/DocEditor'
import { Production, QuoteList, WorkOrderList } from './pages/Lists'
import { Catalog, CreateOrganization, Login, More } from './pages/Misc'
import PrintDoc from './pages/PrintDoc'
import PublicPortal from './pages/PublicPortal'
import QuoteView from './pages/QuoteView'
import Settings from './pages/Settings'
import WorkOrderView from './pages/WorkOrderView'

function Private() {
  const { session, loading } = useApp()
  if (loading) return <Loading />
  if (!session) return <Login />
  if (!session.organizationId) return <CreateOrganization />
  return (
    <Routes>
      <Route path="/imprimir/:kind/:id" element={<PrintDoc />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="orcamentos" element={<QuoteList />} />
        <Route path="orcamentos/novo" element={<DocEditor kind="quote" key="new-quote" />} />
        <Route path="orcamentos/:id" element={<QuoteView />} />
        <Route path="orcamentos/:id/editar" element={<DocEditor kind="quote" />} />
        <Route path="os" element={<WorkOrderList />} />
        <Route path="os/nova" element={<DocEditor kind="work_order" key="new-os" />} />
        <Route path="os/:id" element={<WorkOrderView />} />
        <Route path="os/:id/editar" element={<DocEditor kind="work_order" />} />
        <Route path="producao" element={<Production />} />
        <Route path="clientes" element={<CustomerList />} />
        <Route path="clientes/:id" element={<CustomerDetail />} />
        <Route path="veiculos/:id" element={<VehicleDetail />} />
        <Route path="catalogo" element={<Catalog />} />
        <Route path="config" element={<Settings />} />
        <Route path="mais" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

// Na demonstração (página única hospedada) as rotas ficam só em memória.
const Router = import.meta.env.VITE_DEMO ? MemoryRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/c/:token" element={<PublicPortal />} />
        <Route
          path="*"
          element={
            <AppProvider>
              <Private />
            </AppProvider>
          }
        />
      </Routes>
    </Router>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_DEMO) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
