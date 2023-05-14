import React from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import './style/bootstrap.min.css';

createRoot(document.getElementById('root')).render(<BrowserRouter>
                        <App />
                        </BrowserRouter>);