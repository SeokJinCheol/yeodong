import React from 'react';
import { AccountGate } from './pages/AccountGate';
import ReactDOM from 'react-dom/client';
import { WorkspacePage } from './pages/WorkspacePage';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AccountGate>
            <WorkspacePage />
        </AccountGate>
    </React.StrictMode>,
);
