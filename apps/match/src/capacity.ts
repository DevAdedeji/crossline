import { ONLINE_CAPACITY_TARGET } from '@crossline/shared'
export function onlineCapacity(env:NodeJS.ProcessEnv=process.env){
 const capacity=Number(env.FFA_MAX_CLIENTS??ONLINE_CAPACITY_TARGET)
 if(!Number.isInteger(capacity)||capacity<2||capacity>ONLINE_CAPACITY_TARGET)throw new Error(`FFA_MAX_CLIENTS must be an integer from 2 to ${ONLINE_CAPACITY_TARGET}`)
 return capacity
}
