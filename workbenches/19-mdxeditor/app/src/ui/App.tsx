// ABOUTME: 展示应用信息和加载状态，不预设业务模型。

import { useEffect, useState } from 'react';
import { LayoutGrid, RefreshCw, Inbox, CircleAlert } from 'lucide-react';
import { getPageConnection } from './connection';
import { isAppInfo, type AppInfo } from '../contracts/app';
import { text } from './messages';

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [request, setRequest] = useState(0);
  useEffect(() => {
    let disposed = false;
    setFailed(false);
    void (async () => {
      const page = await getPageConnection();
      const response = await page.fetch('/api/app');
      const value: unknown = await response.json();
      if (!response.ok || !isAppInfo(value)) throw new Error('APP_RESPONSE_INVALID');
      if (!disposed) { setInfo(value); document.title = value.name; }
    })().catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; };
  }, [request]);
  return (
    <main className="app-shell">
      <header className="app-header">
        <LayoutGrid aria-hidden="true" size={20} />
        <h1>{info?.name ?? text('loading')}</h1>
        {info && <span className="app-version">{info.version}</span>}
      </header>
      {info && <p className="app-platform" data-test-id="app-platform-status" role="status">{text(info.platform)}</p>}
      <section className="app-state" aria-live="polite">
        {failed ? <CircleAlert size={28} aria-hidden="true" /> : <Inbox size={28} aria-hidden="true" />}
        <p>{text(failed ? 'failure' : info ? 'empty' : 'loading')}</p>
        {failed && <button type="button" data-test-id="app-retry" onClick={() => setRequest(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />{text('retry')}</button>}
      </section>
    </main>
  );
}
