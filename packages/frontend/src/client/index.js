import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import './style/bootstrap.min.css';
const clientUtil = require('./clientUtil');

clientUtil.applyThemeClass(clientUtil.getTheme());

createRoot(document.getElementById('root')).render(<BrowserRouter>
                        <App />
                        </BrowserRouter>);