import * as THREE from 'three'
import { TerrainGenerator } from './generation/terrain'

export interface GameObjectsResult {
    clickableObjects: THREE.Mesh[]
    terrainGen: TerrainGenerator
}

export function createGameObjects(): GameObjectsResult {
    // Cube
    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x00ff00, metalness: 0.5, roughness: 0.5 })
    )
    cube.position.x = -2
    cube.castShadow = true
    cube.receiveShadow = true

    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.5, roughness: 0.5 })
    )
    sphere.position.x = 0
    sphere.castShadow = true
    sphere.receiveShadow = true

    const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.2, 16, 100),
        new THREE.MeshStandardMaterial({ color: 0x0000ff, metalness: 0.5, roughness: 0.5 })
    )
    torus.position.x = 2
    torus.castShadow = true
    torus.receiveShadow = true
    
    const terrainGen = new TerrainGenerator()
    for (const mesh of [cube, sphere, torus]) {
        mesh.position.y = terrainGen.getTerrainHeightAtWorldPosition(mesh.position.x, mesh.position.z) + 1
    }
    
    const clickableObjects = [cube, sphere, torus]
    
    return {
        clickableObjects,
        terrainGen
    };
}