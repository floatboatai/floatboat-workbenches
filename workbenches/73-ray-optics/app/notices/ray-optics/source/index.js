// Floatboat adapter entry (MIT, see app/LICENSE). Exposes the pinned upstream
// Ray Optics core unchanged and initialises the upstream i18next namespaces so
// native error messages and object-bar labels are available in Chinese with an
// English fallback. No optical algorithm is reimplemented here.
import i18next from 'i18next';
import zhMain from '../locales/zh-CN/main.json';
import zhSimulator from '../locales/zh-CN/simulator.json';
import enMain from '../locales/en/main.json';
import enSimulator from '../locales/en/simulator.json';

if (!i18next.isInitialized) {
  i18next.init({
    lng: 'zh-CN',
    fallbackLng: 'en',
    initImmediate: false,
    resources: {
      'zh-CN': { main: zhMain, simulator: zhSimulator },
      en: { main: enMain, simulator: enSimulator },
    },
    interpolation: { escapeValue: false },
  });
}

export { default as Scene } from './Scene.js';
export { default as Simulator } from './Simulator.js';
export { default as Editor } from './Editor.js';
export { default as geometry } from './geometry.js';
export * as sceneObjs from './sceneObjs.js';
export { i18next };
