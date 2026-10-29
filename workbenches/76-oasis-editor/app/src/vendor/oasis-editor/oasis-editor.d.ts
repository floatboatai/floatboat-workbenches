export * from 'oasis-editor';
export function setWorkbenchFonts(regular:Uint8Array,bold:Uint8Array):void;
export function registerWorkbenchLocale(id:string,strings:Record<string,string>):void;
export function setWorkbenchRevisionAuthor(name:string):void;
