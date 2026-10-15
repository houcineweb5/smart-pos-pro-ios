import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Wire window.print to native Android PrintManager when running inside Android APK
if (typeof window !== 'undefined') {
  const originalPrint = window.print;
  window.print = function () {
    if ((window as any).AndroidNative?.printCurrentPage) {
      try {
        (window as any).AndroidNative.printCurrentPage(document.title || 'SmartPOS Print');
        return;
      } catch (e) {
        console.warn('AndroidNative.printCurrentPage fallback:', e);
      }
    }
    if (originalPrint) {
      originalPrint.call(window);
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
