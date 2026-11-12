import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
export function testStore(){
 const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
 for(const file of readdirSync(new URL("../drizzle/",import.meta.url)).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),"utf8"));
 function prepare(sql:string){let bindings:unknown[]=[];return{
  bind(...args:unknown[]){bindings=args;return this;},
  async first(){return sqlite.prepare(sql).get(...bindings as any[])||null;},
  async all(){return{results:sqlite.prepare(sql).all(...bindings as any[]),success:true,meta:{}};},
  async run(){return this.execute();},
  execute(){const statement=sqlite.prepare(sql);if(statement.columns().length)return{results:statement.all(...bindings as any[]),success:true,meta:{changes:0}};const result=statement.run(...bindings as any[]);return{success:true,results:[],meta:{changes:Number(result.changes)}};},
 };}
 async function batch(statements:ReturnType<typeof prepare>[]){
  sqlite.exec("BEGIN");try{const results=statements.map(s=>s.execute());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}
 }
 return{db:{prepare,batch} as unknown as D1Database,sqlite};
}
