import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'

function Placeholder({ title }: { title: string }) {
  return <div className="p-8"><h1 className="text-2xl font-bold">{title}</h1></div>
}

/** T2 route skeleton. Page content and business interactions belong to T3. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Placeholder title="户外大冒险" />} />
        <Route path="plan/:id" element={<Placeholder title="计划详情" />} />
        <Route path="login" element={<Placeholder title="登录" />} />
      </Route>
    </Routes>
  )
}
