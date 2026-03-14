import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Warehouses from '@/pages/Warehouses';
import Locations from '@/pages/Locations';
import Movements from '@/pages/Movements';
import Scheduled from '@/pages/Scheduled';
import Transfer from '@/pages/Transfer';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route path="locations" element={<Locations />} />
        <Route path="movements" element={<Movements />} />
        <Route path="scheduled" element={<Scheduled />} />
        <Route path="transfer" element={<Transfer />} />
      </Route>
    </Routes>
  );
}
