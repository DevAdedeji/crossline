import { browserAccount } from './accounts'
import { createTestAccount } from '../../scripts/test-account'
import {test,expect} from '@playwright/test'
import {Client,type Room} from '@colyseus/sdk'
test('full shared arena explains waiting, admits a freed seat, preserves account identity and shows public leaderboards',async({page})=>{
 test.setTimeout(60000)
 const client=new Client('ws://127.0.0.1:2569'),seats:Room[]=[]
 try{
  for(let i=0;i<8;i++){const account=await createTestAccount('http://127.0.0.1:3001',`slot${i}`);const seat=await client.joinOrCreate('ffa',{joinToken:await account.token()});seat.onMessage('event',()=>{});seat.onMessage('leaderboard',()=>{});seats.push(seat)}
  expect(new Set(seats.map(s=>s.roomId)).size).toBe(1)
  await browserAccount(page,'accountqa')
  await page.goto('/');await page.getByRole('textbox',{name:'Nickname'}).fill('GUESTQA')
  await page.getByRole('button',{name:'Online Free-for-All',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Arena is full',{timeout:30000})
  const last=seats.pop()!;await last.leave()
  await page.getByRole('button',{name:'Reload and reconnect',exact:true}).click()
  await expect(page.locator('.radar-panel')).toContainText('Connected',{timeout:30000})
  await expect(page.locator('main.arena')).toHaveAttribute('data-room-id',seats[0]!.roomId)
  await page.getByRole('button',{name:'Enter arena',exact:true}).click()
  await expect(page.locator('main.arena')).toHaveAttribute('data-player-id',/.+/)
  const id=await page.locator('main.arena').getAttribute('data-player-id'),name=await page.locator(`[data-actor="${id}"] title`).textContent()
  expect(name).toBe('accountqa')
  expect(await page.evaluate(()=>localStorage.getItem('crossline.guest'))).toBeNull()
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu',exact:true}).click()
  await page.getByRole('button',{name:'LEADERBOARD',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Arena leaders'})).toBeVisible()
  await expect(page.getByTestId('stats-durability')).toContainText('PERSISTENT TOTALS')
  for(const title of ['TOP KILLS','TOP DEATHS']){
   const list=page.getByRole('list',{name:title,exact:true});await expect(list.getByRole('listitem').first()).toContainText(/0/)
   expect(await list.innerText()).not.toMatch(/Circular|undefined/)
  }
  await page.getByRole('button',{name:'CLOSE',exact:true}).click()
  await page.getByRole('button',{name:'Online Free-for-All',exact:true}).click()
  await expect(page.locator('main.arena')).toHaveAttribute('data-phase','playing',{timeout:30000})
  await expect(page.getByRole('button',{name:/^LEADERBOARD/})).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('dialog',{name:'Arena leaders'})).toBeVisible()
  await expect(page.locator('.menu-card .leaderboard')).toHaveCount(0)
  await page.getByRole('button',{name:'BACK · ESC / B / ○',exact:true}).click()
  const nextId=await page.locator('main.arena').getAttribute('data-player-id')
  await expect(page.locator(`[data-actor="${nextId}"] title`)).toHaveText(name!)
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu',exact:true}).click()
 }finally{for(const seat of seats){seat.reconnection.enabled=false;await seat.leave()}}
})
