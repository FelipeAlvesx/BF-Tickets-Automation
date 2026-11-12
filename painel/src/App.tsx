import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'

const Hoje = lazy(() => import('./pages/Hoje'))
const Pedidos = lazy(() => import('./pages/Pedidos'))
const Conversas = lazy(() => import('./pages/Conversas'))
const Ofertas = lazy(() => import('./pages/Ofertas'))
const Eventos = lazy(() => import('./pages/Eventos'))
const Agenda = lazy(() => import('./pages/Agenda'))
const Textos = lazy(() => import('./pages/Textos'))
const WhatsAppPage = lazy(() => import('./pages/WhatsApp'))
const Ajustes = lazy(() => import('./pages/Ajustes'))

export default function App() {
  const loc = useLocation()
  return (
    <Shell>
      <Suspense fallback={null}>
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<Hoje />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/conversas" element={<Conversas />} />
          <Route path="/ofertas" element={<Ofertas />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/textos" element={<Textos />} />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  )
}
