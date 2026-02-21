import './style.css'
import * as THREE from 'three'
import { MapControls } from 'three/examples/jsm/controls/MapControls.js'
import { setupScene } from './scene'
import { setupLighting, setupEnvironment } from './lighting'
import { createGameObjects } from './gameObjects'
import { setupControls } from './mapControls'
import { setupInputHandlers } from './keyboard'
import { setupResizeHandler } from './window'
import { animate } from './gameLoop'
import { TileManager } from './generation/tileManager'
import { saveCameraTransform, loadCameraTransform, resetCameraToDefault } from './cameraTransform'

function setupClickHandler(camera: THREE.Camera, clickableObjects: THREE.Mesh[]) {
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    window.addEventListener('click', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(clickableObjects)

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object as THREE.Mesh
            console.log('Clicked mesh:', clickedMesh)
        }
    })
}

function setupCameraTransformUI(camera: THREE.Camera, controls: MapControls, tileManager: TileManager) {
    const saveBtn = document.getElementById('saveCameraBtn')
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveCameraTransform(camera, controls)
        })
    }
    
    const resetBtn = document.getElementById('resetCameraBtn')
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetCameraToDefault(camera, controls, tileManager)
        })
    }
}

function init() {
    console.log('Initializing game...')
    const { scene, camera, renderer } = setupScene()

    setupEnvironment(scene, renderer)
    const lights = setupLighting(scene)
    const { clickableObjects } = createGameObjects()
    clickableObjects.forEach(obj => scene.add(obj))
    
    const tileManager = new TileManager(scene)
    
    const controls = setupControls(camera, renderer)

    // Load camera transform AFTER controls are set up
    loadCameraTransform(camera, controls)

    setupInputHandlers()
    setupResizeHandler(camera as any, renderer)
    setupClickHandler(camera, clickableObjects)
    setupCameraTransformUI(camera, controls, tileManager)

    animate({ scene, camera, renderer, controls, objects: clickableObjects, tileManager, lights })
}

init()
