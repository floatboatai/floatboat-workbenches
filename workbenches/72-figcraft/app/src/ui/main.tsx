// ABOUTME: 挂载工作台页面，业务展示在组件中维护。

import { createRoot } from 'react-dom/client';
import { App } from './App';
import { RenderBoundary } from './workspace';
import './style.css';

const container = document.getElementById('root');
if (!container) throw new Error('APP_ROOT_MISSING');
createRoot(container).render(<RenderBoundary><App /></RenderBoundary>);
