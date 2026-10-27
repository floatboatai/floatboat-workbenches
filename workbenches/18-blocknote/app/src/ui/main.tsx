import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './style.css';
const container = document.getElementById('root');
if (!container) throw new Error('APP_ROOT_MISSING');
createRoot(container).render(<App />);
