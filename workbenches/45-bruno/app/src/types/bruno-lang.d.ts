declare module '@usebruno/lang' {
 const lang: {bruToJsonV2:(source:string)=>unknown;jsonToBruV2:(value:unknown)=>string;collectionBruToJson:(source:string)=>unknown;jsonToCollectionBru:(value:unknown)=>string};
 export default lang;
}
