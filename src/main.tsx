import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Global styles
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior: none;
  }
  input::placeholder {
    opacity: 0.5;
  }
  button:active {
    opacity: 0.8;
  }
  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(128,128,128,0.3);
    border-radius: 4px;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(0,230,109,0.15);
    border-top-color: #00e66d;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  select option {
    background: #1a2030;
    color: #fff;
  }
`;
document.head.appendChild(style);

// Load Inter font
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
document.head.appendChild(link);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
