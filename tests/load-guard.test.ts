import { onlineCapacity } from '../apps/match/src/capacity.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCapacity } from '../apps/match/src/loadMetrics.ts'
test('experimental capacity cannot enable a public listener, real database or unbounded load clients',()=>{
 const keys=['NODE_ENV','CROSSLINE_LOCAL_LOAD','MATCH_HOST','AUTH_DEV_LOCAL','AUTH_LOCAL_PATH','DATABASE_URL','FFA_MAX_CLIENTS']
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]))
 try{
  delete process.env.CROSSLINE_LOCAL_LOAD;assert.equal(loadCapacity(),undefined)
  Object.assign(process.env,{NODE_ENV:'test',CROSSLINE_LOCAL_LOAD:'1',MATCH_HOST:'127.0.0.1',AUTH_DEV_LOCAL:'1',AUTH_LOCAL_PATH:':memory:',DATABASE_URL:'',FFA_MAX_CLIENTS:'32'})
  assert.equal(loadCapacity(),32)
  for(const [key,value] of [['MATCH_HOST','0.0.0.0'],['NODE_ENV','production'],['DATABASE_URL','postgres://invalid'],['AUTH_LOCAL_PATH','real-data'],['FFA_MAX_CLIENTS','500']]){
   const original=process.env[key!];process.env[key!]=value;assert.throws(()=>loadCapacity());process.env[key!]=original
  }
 }finally{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}}
})


test('normal Online admission defaults to 100, accepts explicit smaller caps and rejects values outside 2–100',()=>{
 assert.equal(onlineCapacity({}),100)
 for(const n of [2,8,32,100])assert.equal(onlineCapacity({FFA_MAX_CLIENTS:String(n)}),n)
 for(const value of ['1','101','500','NaN','Infinity','2.5',''])assert.throws(()=>onlineCapacity({FFA_MAX_CLIENTS:value}))
})
