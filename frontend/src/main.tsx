import React from 'react';
import { AccountGate } from './pages/AccountGate';
import ReactDOM from 'react-dom/client';
import { PlannerPage } from './pages/PlannerPage';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AccountGate>
            <PlannerPage />
        </AccountGate>
    </React.StrictMode>,
);
