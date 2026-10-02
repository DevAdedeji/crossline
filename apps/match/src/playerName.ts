export function playerName(value: unknown, id: string): string {
  const label=typeof value==='string' ? value.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,16) : ''
  return `${label || 'OPERATOR'}-${id.slice(-4).toUpperCase()}`
}
