import {
  activeCampaignTask,
  getCampaignMission,
  type CampaignState,
} from '@crossline/shared/campaign'
import type { Position } from '@crossline/shared'

export interface MissionWaypoint {
  id: string
  label: string
  x: number
  y: number
  angle: number
  edge: boolean
  distance: number
  secondary: boolean
}
interface View extends Position {
  yaw: number
  pitch: number
  fov: number
}
/** Screen-space navigation stays visible through cover and when a target is behind you. */
export function campaignWaypoints(
  state: CampaignState,
  view: View,
  width: number,
  height: number,
  mobile: boolean,
): MissionWaypoint[] {
  if (state.outcome !== 'active' || width <= 0 || height <= 0) return []
  const mission = getCampaignMission(state.missionId),
    objectives = mission.objectives
  const task = activeCampaignTask(state)
  const markedEnemy = state.operation?.targets
    .slice()
    .sort(
      (a, b) => Math.hypot(a.x - view.x, a.z - view.z) - Math.hypot(b.x - view.x, b.z - view.z),
    )[0]
  const targets = mission.tasks
    ? [
        {
          id: 'objective',
          label: markedEnemy ? 'MARKED SQUAD' : task.title.toUpperCase(),
          position: markedEnemy ?? task.position,
          secondary: false,
        },
        ...(state.waiting
          ? [
              {
                id: 'companion',
                label: mission.companion.toUpperCase(),
                position: state.captive,
                secondary: true,
              },
            ]
          : []),
      ]
    : state.stage === 'extract'
      ? [
          {
            id: 'extraction',
            label: 'EXTRACTION',
            position: objectives.extract.position,
            secondary: false,
          },
          ...(state.waiting
            ? [
                {
                  id: 'finch',
                  label: `${mission.companion.toUpperCase()} · REGROUP`,
                  position: state.captive,
                  secondary: true,
                },
              ]
            : []),
        ]
      : state.stage === 'rescue'
        ? [
            {
              id: mission.kind === 'sabotage' ? 'charge' : 'finch',
              label: mission.kind === 'sabotage' ? 'CHARGE' : mission.companion.toUpperCase(),
              position: state.captive,
              secondary: false,
            },
          ]
        : [
            {
              id: 'relay',
              label: objectives.relay.title.toUpperCase(),
              position: objectives.relay.position,
              secondary: false,
            },
            {
              id: mission.kind === 'sabotage' ? 'charge' : 'finch',
              label: mission.kind === 'sabotage' ? 'CHARGE' : mission.companion.toUpperCase(),
              position: state.captive,
              secondary: true,
            },
          ]
  const tan = Math.tan(view.fov / 2),
    aspect = width / height
  const points = targets.map((target) => {
    const dx = target.position.x - view.x,
      dz = target.position.z - view.z,
      dy = target.position.y + 2.3 - view.y
    const right = dx * Math.cos(view.yaw) - dz * Math.sin(view.yaw)
    const forward = dx * Math.sin(view.yaw) + dz * Math.cos(view.yaw)
    const up = dy * Math.cos(view.pitch) + forward * Math.sin(view.pitch)
    const depth = forward * Math.cos(view.pitch) - dy * Math.sin(view.pitch)
    let x = right / (Math.max(0.1, Math.abs(depth)) * tan * aspect) / 2
    let y = -up / (Math.max(0.1, Math.abs(depth)) * tan) / 2
    if (depth <= 0) {
      x = right < 0 ? -1 : 1
      y = 0
    }
    const marginX = mobile ? 0.5 - Math.min(170, width * 0.3) / width : 0.39,
      marginY = mobile ? 0.16 : 0.23
    const scale = Math.min(
      1,
      marginX / Math.max(0.001, Math.abs(x)),
      marginY / Math.max(0.001, Math.abs(y)),
    )
    return {
      id: target.id,
      label: target.label,
      x: (0.5 + x * scale) * 100,
      y: (0.5 + y * scale) * 100,
      angle: (Math.atan2(y, x) * 180) / Math.PI,
      edge: depth <= 0 || scale < 1,
      distance: Math.round(Math.hypot(dx, dz)),
      secondary: target.secondary,
    }
  })
  // When two objectives are behind the camera, separate their edge markers.
  if (
    points[0] &&
    points[1] &&
    Math.abs(points[0].x - points[1].x) < 12 &&
    Math.abs(points[0].y - points[1].y) < 14
  )
    points[1].y = points[0].y + (points[0].y >= 50 ? -14 : 14)
  return points
}
