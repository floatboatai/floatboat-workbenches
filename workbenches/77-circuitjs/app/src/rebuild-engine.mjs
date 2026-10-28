// SPDX-License-Identifier: GPL-2.0-or-later
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const source=manifest.resources.find(r=>r.id==='engine-source');
await import(new URL(source.path+'/build.mjs',root).href);
