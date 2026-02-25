/** Available VRM idle/pose animations (URLs to .vrma files). Add more files here to get more poses. */
export const animations = {
  idleLoop: new URL('./idle_loop.vrma', import.meta.url),
  /** Same as idleLoop for now; replace with a different .vrma to get a different stand pose. */
  idleStand: new URL('./idle_loop.vrma', import.meta.url),
}

export type VRMIdlePoseKey = keyof typeof animations

/** Options for the idle pose selector (label shown in UI). */
export const VRM_IDLE_POSE_OPTIONS: Array<{ id: VRMIdlePoseKey; label: string }> = [
  { id: 'idleLoop', label: 'Idle (loop)' },
  { id: 'idleStand', label: 'Stand' },
]

export function getVRMIdleAnimationUrl(key: VRMIdlePoseKey): string {
  return animations[key].toString()
}
