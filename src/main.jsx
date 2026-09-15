import React from 'react';
import ReactDOM from 'react-dom/client';
import { preparePreview } from './runtime';
import './index.css';
import './redesign.css';
preparePreview();
import('./App.jsx').then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
});
