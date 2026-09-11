import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Safe fallback for window.confirm and window.alert inside iframe sandboxes
if (typeof window !== "undefined") {
  const originalConfirm = window.confirm;
  const isIframe = window.self !== window.top;

  window.confirm = (message?: string) => {
    if (isIframe) {
      console.log("Iframe environment detected. Auto-confirming dialog to bypass sandbox block:", message);
      return true;
    }
    try {
      return originalConfirm ? originalConfirm(message) : true;
    } catch (e) {
      console.warn("window.confirm is blocked or failed in this environment, auto-confirming:", e);
      return true;
    }
  };

  const originalAlert = window.alert;
  window.alert = (message?: any) => {
    try {
      if (originalAlert) {
        originalAlert(message);
      } else {
        console.log("ALERT:", message);
      }
    } catch (e) {
      console.warn("window.alert is blocked in this environment:", message, e);
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
