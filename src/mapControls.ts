import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'

export function setupControls(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    const controls = new MapControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.autoRotate = false
    controls.panSpeed = 2.5
    controls.zoomSpeed = 1.5
    controls.maxZoom = 20
    controls.minZoom = 2
    controls.maxPolarAngle = Math.PI * 0.55

    return controls
}
