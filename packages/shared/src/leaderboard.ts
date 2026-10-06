export interface LeaderboardRow {
  id: string
  displayName: string
  kills: number
  deaths: number
}
export interface Leaderboard {
  topKills: LeaderboardRow[]
  topDeaths: LeaderboardRow[]
  durable: boolean
  delayed: boolean
}
