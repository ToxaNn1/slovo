import '@fontsource-variable/golos-text';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/unbounded';
import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Admin } from './router';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root');
createRoot(root).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
);
