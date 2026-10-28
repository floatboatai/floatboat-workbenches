// Workbench integration: pin the bundled catalog; no deployed catalog resolver.
import type { CrawlerRegistryEntry } from './registry.ts';
import coverage from '../coverage.json' with {type:'json'};
type Snapshot={version:string;payload:{identities:readonly CrawlerRegistryEntry[];platforms:typeof coverage.platforms;products:typeof coverage.products;referrals:typeof coverage.referrals}};
export function getPublishedCatalog():Snapshot|undefined{return undefined;}
