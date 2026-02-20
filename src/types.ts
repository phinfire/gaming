import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { TileManager } from './generation/tileManager'

export type RenderContext = {
    scene: THREE.Scene
    camera: THREE.Camera
    renderer: THREE.WebGLRenderer
    controls: MapControls
    objects: THREE.Mesh[]
    tileManager?: TileManager
    lights?: { ambientLight: THREE.AmbientLight; directionalLight: THREE.DirectionalLight }
}
