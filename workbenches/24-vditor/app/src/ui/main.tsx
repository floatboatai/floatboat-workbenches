import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';
const container = document.getElementById('root');
if (!container) throw new Error('APP_ROOT_MISSING');
const root = createRoot(container);
// The upstream synchronous icon loader executes inline text. Use a CSP-compatible
// external script once, then tell each instance not to run that loader.
const icons = document.createElement('script');
icons.src = '/api/vditor/dist/js/icons/ant.js';
icons.id = 'article-native-icons';
icons.onload = () => root.render(<App />);
icons.onerror = () => root.render(<main role="alert"><p>文章工具未能加载，请刷新重试。</p><button onClick={() => location.reload()}>刷新</button></main>);
root.render(<p role="status">正在准备写作工具…</p>);
document.head.appendChild(icons);
