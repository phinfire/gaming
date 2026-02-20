import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { inputState } from './keyboard'
import { updateLighting } from './lighting'
import type { RenderContext } from './types'

export const PAN_SPEED = 0.5

export function updateCameraMovement(camera: THREE.Camera, controls: MapControls) {
    const { w, a, s, d } = inputState.keys
    if (!w && !a && !s && !d) return
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    forward.copy(controls.target).sub(camera.position)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, up).normalize()
    const movement = new THREE.Vector3()
    if (w) movement.addScaledVector(forward, PAN_SPEED)
    if (s) movement.addScaledVector(forward, -PAN_SPEED)
    if (d) movement.addScaledVector(right, PAN_SPEED)
    if (a) movement.addScaledVector(right, -PAN_SPEED)

    camera.position.add(movement)
    controls.target.add(movement)
}

export function animate(ctx: RenderContext) {
    requestAnimationFrame(() => animate(ctx))
    updateCameraMovement(ctx.camera, ctx.controls)
    ctx.controls.update()
    
    if (ctx.tileManager) {
        ctx.tileManager.update(ctx.camera.position)
    }
    
    if (ctx.lights) {
        updateLighting(ctx.lights, ctx.camera.position)
    }

    ctx.renderer.render(ctx.scene, ctx.camera)
}
