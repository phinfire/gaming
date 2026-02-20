import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'

const STORAGE_KEY = 'savedCameraTransform'

export interface CameraTransform {
    position: { x: number; y: number; z: number }
    target: { x: number; y: number; z: number }
    fov: number
}

export function saveCameraTransform(camera: THREE.Camera, controls: MapControls): void {
    const perspective = camera as THREE.PerspectiveCamera
    const transform: CameraTransform = {
        position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        },
        target: {
            x: controls.target.x,
            y: controls.target.y,
            z: controls.target.z
        },
        fov: perspective.fov
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transform))
    console.log('Camera transform saved:', transform)
}

export function loadCameraTransform(camera: THREE.Camera, controls: MapControls): boolean {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return false

    try {
        const transform: CameraTransform = JSON.parse(saved)
        camera.position.set(transform.position.x, transform.position.y, transform.position.z)
        if (transform.target) {
            controls.target.set(transform.target.x, transform.target.y, transform.target.z)
        } else {
            controls.target.set(0, 0, 0)
        }
        controls.update()
        
        const perspective = camera as THREE.PerspectiveCamera
        if (transform.fov && perspective.fov) {
            perspective.fov = transform.fov
            perspective.updateProjectionMatrix()
        }
        
        console.log('Camera transform loaded:', transform)
        return true
    } catch (e) {
        console.error('Failed to load camera transform:', e)
        return false
    }
}

export function clearCameraTransform(): void {
    localStorage.removeItem(STORAGE_KEY)
    console.log('Camera transform cleared')
}

export function resetCameraToDefault(camera: THREE.Camera, controls: MapControls): void {
    if (!loadCameraTransform(camera, controls)) {
        camera.position.set(-50, 100, -50)
        controls.target.set(0, 0, 0)
        controls.update()
        console.log('Camera reset to default position')
    }
}
