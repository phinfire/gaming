import * as THREE from 'three'
import { TerrainGenerator } from './terrain'
import { TREE_CONFIG } from '../config'

interface TreeInstance {
    position: THREE.Vector3
    scale: number
    rotation: number
}

export interface TreeGenerator {
    applyTreesFromData(tile: THREE.Mesh, tileX: number, tileZ: number, trees: Array<{ x: number; z: number; scale: number; rotation: number }>): void
    unloadTreesForTile(tileKey: string): void
    dispose(): void
}

export class ConifersTreeGenerator implements TreeGenerator {
    private treeInstancesPerTile = new Map<string, { trunkMesh: THREE.InstancedMesh; foliageMesh: THREE.InstancedMesh }>()
    private scene: THREE.Scene
    private terrainGen: TerrainGenerator
    private trunkGeometry: THREE.CylinderGeometry
    private foliageGeometry: THREE.ConeGeometry
    private materials = { trunk: new THREE.MeshPhongMaterial({ color: TREE_CONFIG.trunkColor }), foliage: new THREE.MeshPhongMaterial({ color: TREE_CONFIG.foliageColor }) }

    constructor(scene: THREE.Scene, terrainGen: TerrainGenerator, _tileSize: number, _treesPerTile: number) {
        this.scene = scene
        this.terrainGen = terrainGen
        this.trunkGeometry = new THREE.CylinderGeometry(
            TREE_CONFIG.trunkRadiusBottom,
            TREE_CONFIG.trunkRadiusTop,
            TREE_CONFIG.trunkHeight,
            TREE_CONFIG.trunkSegments
        )
        this.foliageGeometry = new THREE.ConeGeometry(
            TREE_CONFIG.foliageRadius,
            TREE_CONFIG.foliageHeight,
            TREE_CONFIG.foliageSegments
        )
    }

    private getTileCoordKey(x: number, z: number): string {
        return `${x},${z}`
    }

    private placeTreesOnTile(tile: THREE.Mesh, tileX: number, tileZ: number, trees: TreeInstance[]): void {
        if (trees.length === 0) return

        const tileKey = this.getTileCoordKey(tileX, tileZ)
        const trunkMesh = new THREE.InstancedMesh(this.trunkGeometry, this.materials.trunk, trees.length)
        const foliageMesh = new THREE.InstancedMesh(this.foliageGeometry, this.materials.foliage, trees.length)
        
        trunkMesh.castShadow = true
        trunkMesh.receiveShadow = true
        foliageMesh.castShadow = true
        foliageMesh.receiveShadow = true
        
        const matrix = new THREE.Matrix4()
        const trunkHeight = TREE_CONFIG.trunkHeight
        const foliageHeight = TREE_CONFIG.foliageHeight
        const quaternion = new THREE.Quaternion()
        
        for (let i = 0; i < trees.length; i++) {
            const tree = trees[i]
            const terrainHeight = this.terrainGen.getTerrainHeightAtWorldPosition(tree.position.x, tree.position.z)
            const baseHeight = tile.position.y + terrainHeight

            quaternion.setFromEuler(new THREE.Euler(0, tree.rotation, 0))
            const trunkPos = new THREE.Vector3(tree.position.x, baseHeight + (trunkHeight / 2) * tree.scale, tree.position.z)
            const scale = new THREE.Vector3(tree.scale, tree.scale, tree.scale)
            matrix.compose(trunkPos, quaternion, scale)
            trunkMesh.setMatrixAt(i, matrix)
            
            const foliagePos = new THREE.Vector3(tree.position.x, baseHeight + (trunkHeight + foliageHeight / 2) * tree.scale, tree.position.z)
            matrix.compose(foliagePos, quaternion, scale)
            foliageMesh.setMatrixAt(i, matrix)
        }
        
        trunkMesh.instanceMatrix.needsUpdate = true
        foliageMesh.instanceMatrix.needsUpdate = true
        this.scene.add(trunkMesh)
        this.scene.add(foliageMesh)
        
        this.treeInstancesPerTile.set(tileKey, { trunkMesh, foliageMesh })
    }

    applyTreesFromData(tile: THREE.Mesh, tileX: number, tileZ: number, trees: Array<{ x: number; z: number; scale: number; rotation: number }>): void {
        const treesToPlace: TreeInstance[] = trees.map(t => ({
            position: new THREE.Vector3(t.x, 0, t.z),
            scale: t.scale,
            rotation: t.rotation
        }))
        
        this.placeTreesOnTile(tile, tileX, tileZ, treesToPlace)
    }

    unloadTreesForTile(tileKey: string): void {
        const meshes = this.treeInstancesPerTile.get(tileKey)
        if (meshes) {
            this.scene.remove(meshes.trunkMesh)
            this.scene.remove(meshes.foliageMesh)
            meshes.trunkMesh.dispose()
            meshes.foliageMesh.dispose()
            this.treeInstancesPerTile.delete(tileKey)
        }
    }

    dispose(): void {
        this.materials.trunk.dispose()
        this.materials.foliage.dispose()
        this.trunkGeometry.dispose()
        this.foliageGeometry.dispose()

        for (const meshes of this.treeInstancesPerTile.values()) {
            meshes.trunkMesh.dispose()
            meshes.foliageMesh.dispose()
        }
        this.treeInstancesPerTile.clear()
    }
}
