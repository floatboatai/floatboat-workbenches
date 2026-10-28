declare module '@penpot/library' {
 interface Context {currentFileId:string;currentPageId:string;addFile(x:Record<string,unknown>):string;closeFile():void;addPage(x:Record<string,unknown>):string;closePage():void;addBoard(x:Record<string,unknown>):string;closeBoard():void;addRect(x:Record<string,unknown>):string;addText(x:Record<string,unknown>):string;addLibraryColor(x:Record<string,unknown>):string;addLibraryTypography(x:Record<string,unknown>):string;addComponent(x:Record<string,unknown>):string;genId():string;}
 export function createBuildContext():Context;
 export function exportAsBytes(context:Context):Promise<Uint8Array>;
}
