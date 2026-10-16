import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initClientApiInterceptor } from './lib/client-api-interceptor';

try {
  initClientApiInterceptor();
} catch (e) {
  console.info('[FleetBill] Client API interceptor bypassed:', e);
}

createRoot(document.getElementById('root')!).render(<App />);

