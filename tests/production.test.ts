import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,writeFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { signProxy,ProxyVerifier,boundedBody,clientIP } from '../packages/shared/src/proxy.ts'
import { requestGuard,AdmissionLimit,GuestBudget } from '../apps/match/src/admission.ts'
import { matchConfig } from '../apps/match/src/config.ts'
import { databaseOptions } from '../packages/db/src/connection.ts'
import { CommitGate } from '../apps/match/src/commitGate.ts'
const secret='synthetic-proxy-unit-test-secret-2026-only',origin='https://crossline.example',path='/api/auth/sign-in/email',body='{"email":"player@example.test"}'
function signed(ip='203.0.113.10',now=Date.now(),payload=body){return new Request('https://match.example'+path,{method:'POST',headers:{origin,...signProxy(secret,'POST',path,payload,ip,'',now)},body:payload})}
test('signed hop binds IP, path, method, body and cookie; rejects tampering, expiry and replay',()=>{
 const verifier=new ProxyVerifier(secret),request=signed()
 assert.equal(verifier.verify(request,body),'203.0.113.10')
 assert.throws(()=>verifier.verify(request,body))
 for(const field of ['x-crossline-client-ip','cookie']){const req=signed();req.headers.set(field,field==='cookie'?'forged=1':'203.0.113.99');assert.throws(()=>verifier.verify(req,body))}
 assert.throws(()=>verifier.verify(signed(),body+' '))
 assert.throws(()=>verifier.verify(signed('203.0.113.10',Date.now()-31000),body))
 assert.throws(()=>clientIP('203.0.113.10, 127.0.0.1'))
 assert.equal(clientIP('::ffff:203.0.113.10'),'203.0.113.10')
})
test('production guard rejects unsigned requests, wrong origins and spoofed headers, retaining signed IP',async()=>{
 const guard=requestGuard({production:true,origin},secret)
 const unsigned=await guard(new Request('https://match.example'+path,{method:'POST',headers:{'x-forwarded-for':'203.0.113.10','x-crossline-client-ip':'203.0.113.10'},body}))
 assert.ok(unsigned instanceof Response);assert.equal(unsigned.status,403)
 const wrong=signed();wrong.headers.set('origin','https://attacker.example');const denied=await guard(wrong);assert.ok(denied instanceof Response);assert.equal(denied.status,403)
 const valid=signed();valid.headers.set('x-forwarded-for','attacker');const allowed=await guard(valid);assert.ok(allowed instanceof Request);assert.equal(allowed.headers.get('x-crossline-client-ip'),'203.0.113.10');assert.equal(allowed.headers.get('x-forwarded-for'),null);assert.equal(await allowed.text(),body)
})
test('chunked bodies have byte limits without trusting content-length',async()=>{
 const request=new Request('https://match.example',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(4096));c.enqueue(new Uint8Array(4097));c.close()}}),duplex:'half'} as RequestInit)
 await assert.rejects(()=>boundedBody(request),/too large/)
})
test('join rate limits separate clients, expire, and bound attacker-controlled buckets',()=>{
 const limit=new AdmissionLimit(2,100,2)
 assert.equal(limit.accept('a',0),true);assert.equal(limit.accept('a',1),true);assert.equal(limit.accept('a',2),false)
 assert.equal(limit.accept('b',3),true);assert.equal(limit.accept('c',4),false);assert.equal(limit.accept('c',101),true)
})
test('guest budgets bound total rooms and sessions per client and reclaim reservations',()=>{
 const budget=new GuestBudget(2,1);budget.reserve('a');budget.attach('a','ip1');budget.reserve('b')
 assert.throws(()=>budget.reserve('c'));assert.throws(()=>budget.attach('b','ip1'))
 budget.attach('b','ip2');budget.release('a');budget.release('a');assert.equal(budget.size,1)
 budget.reserve('c');budget.attach('c','ip1');budget.release('b');budget.release('c');assert.equal(budget.size,0)
})
const production={NODE_ENV:'production',MATCH_HOST:'0.0.0.0',WEB_ORIGIN:origin,DATABASE_URL:'postgresql://database.example/crossline',DATABASE_CA_FILE:'/placeholder/ca.pem',BETTER_AUTH_SECRET:'synthetic-auth-unit-test-secret-2026-only',MATCH_PROXY_SECRET:secret}
test('production configuration fails closed on missing secrets, local fixtures and insecure origins',()=>{
 assert.equal(matchConfig(production).production,true)
 for(const overrides of [{MATCH_PROXY_SECRET:''},{MATCH_PROXY_SECRET:production.BETTER_AUTH_SECRET},{WEB_ORIGIN:'http://crossline.example'},{WEB_ORIGIN:origin+'/'},{AUTH_DEV_LOCAL:'1'},{CROSSLINE_LOCAL_LOAD:'1'},{DATABASE_CA_FILE:''}])assert.throws(()=>matchConfig({...production,...overrides}))
})
test('runtime and migration PostgreSQL options verify a provider CA and enforce pool limits',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crossline-ca-'))
 try{const path=join(dir,'ca.pem');await writeFile(path,'synthetic-ca-fixture');const options=databaseOptions('postgresql://db.example/crossline?sslmode=require',{DATABASE_CA_FILE:path,DB_POOL_MAX:'3'});assert.deepEqual(options.ssl,{rejectUnauthorized:true,ca:'synthetic-ca-fixture'});assert.equal(options.max,3);assert.throws(()=>databaseOptions('postgresql://db.example/crossline',{DB_POOL_MAX:'6'}));assert.throws(()=>databaseOptions('postgresql://localhost/crossline',{NODE_ENV:'production'}))}finally{await rm(dir,{recursive:true,force:true})}
})
test('failed score commits block publication and retry the same work before acknowledging a kill',async()=>{
 const gate=new CommitGate();let commits=0,published=0
 await gate.submit(async()=>{commits++;if(commits===1)throw new Error('database unavailable')},()=>{published++})
 assert.equal(gate.blocked,true);assert.equal(published,0);assert.throws(()=>gate.submit(async()=>{},()=>{}))
 await Promise.all([gate.retry(),gate.retry()]);assert.equal(commits,2);assert.equal(published,1);assert.equal(gate.blocked,false)
 await gate.retry();assert.equal(published,1)
})
