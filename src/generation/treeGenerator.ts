import * as THREE from 'three'
import { TerrainGenerator } from './terrain'
import { TREE_CONFIG, TILE_CONFIG } from '../config'

type TreeTypeName = 'tallSkinny' | 'shortFat' | 'medium'

interface TreeInstance {
    type: TreeTypeName
    position: THREE.Vector3
    scale: number
    rotation: number
}

export interface TreeGenerator {
    scatterTreesOnTile(tile: THREE.Mesh, tileX: number, tileZ: number): void
    unloadTreesForTile(tileKey: string): void
    dispose(): void
}

export class ConifersTreeGenerator implements TreeGenerator {
    private treeInstancesPerTile = new Map<string, Map<TreeTypeName, THREE.InstancedMesh[]>>()
    private scene: THREE.Scene
    private terrainGen: TerrainGenerator
    private treeGeometries: Map<TreeTypeName, { trunk: THREE.CylinderGeometry; foliage: THREE.ConeGeometry }>
    private materials = { trunk: new THREE.MeshPhongMaterial({ color: TREE_CONFIG.trunkColor }), foliage: new THREE.MeshPhongMaterial({ color: TREE_CONFIG.foliageColor }) }

    constructor(scene: THREE.Scene, terrainGen: TerrainGenerator, _tileSize: number, _treesPerTile: number) {
        this.scene = scene
        this.terrainGen = terrainGen
        this.treeGeometries = new Map()

        // Create geometries for each tree type variant
        const typeNames = Object.keys(TREE_CONFIG.treeTypes) as TreeTypeName[]
        for (const typeName of typeNames) {
            const typeConfig = TREE_CONFIG.treeTypes[typeName]
            
            const trunkHeight = TREE_CONFIG.trunkHeight * typeConfig.trunkHeightMultiplier
            const trunkRadiusBottom = TREE_CONFIG.trunkRadiusBottom * typeConfig.trunkRadiusMultiplier
            const trunkRadiusTop = TREE_CONFIG.trunkRadiusTop * typeConfig.trunkRadiusMultiplier
            const foliageRadius = TREE_CONFIG.foliageRadius * typeConfig.foliageRadiusMultiplier
            const foliageHeight = TREE_CONFIG.foliageHeight * typeConfig.foliageHeightMultiplier
            
            this.treeGeometries.set(typeName, {
                trunk: new THREE.CylinderGeometry(trunkRadiusBottom, trunkRadiusTop, trunkHeight, TREE_CONFIG.trunkSegments),
                foliage: new THREE.ConeGeometry(foliageRadius, foliageHeight, TREE_CONFIG.foliageSegments)
            })
        }
    }

    private seededRandom(seed: number): number {
        const x = Math.sin(seed) * 10000
        return x - Math.floor(x)
    }

    /**
     * Deterministic random number in range [0, 1] using multiple hash functions
     * to reduce patterns from single seeding method
     */
    private hash2D(x: number, y: number, offset: number = 0): number {
        const seed = x * 73856093 ^ y * 19349663 ^ offset * 83492791
        return this.seededRandom(seed)
    }

    /**
     * Select tree type weighted by distribution
     */
    private selectTreeType(seed: number): TreeTypeName {
        const rand = this.seededRandom(seed)
        const types = Object.keys(TREE_CONFIG.treeTypes) as TreeTypeName[]
        const weights = types.map(t => TREE_CONFIG.treeTypes[t].weight)
        const total = weights.reduce((a, b) => a + b, 0)
        
        let cumulative = 0
        for (let i = 0; i < types.length; i++) {
            cumulative += weights[i] / total
            if (rand < cumulative) return types[i]
        }
        return types[types.length - 1]
    }

    private getTileCoordKey(x: number, z: number): string {
        return `${x},${z}`
    }

    scatterTreesOnTile(tile: THREE.Mesh, tileX: number, tileZ: number): void {
        // Generate random candidate positions (not grid-based to avoid visible patterns)
        const candidates: { x: number; z: number }[] = []
        const tileWorldX = tileX * TILE_CONFIG.tileSize
        const tileWorldZ = tileZ * TILE_CONFIG.tileSize
        
        for (let i = 0; i < TREE_CONFIG.candidatePositionsPerTile; i++) {
            // Use 2D hash to deterministically generate random positions within tile
            const randX = this.hash2D(tileX, tileZ, i * 2) * TILE_CONFIG.tileSize - TILE_CONFIG.tileSize / 2
            const randZ = this.hash2D(tileX, tileZ, i * 2 + 1) * TILE_CONFIG.tileSize - TILE_CONFIG.tileSize / 2
            
            candidates.push({
                x: randX,
                z: randZ
            })
        }
        
        // Filter candidates based on forest density noise and assign tree types
        const treesToPlace: TreeInstance[] = []
        
        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i]
            const worldX = tileWorldX + candidate.x
            const worldZ = tileWorldZ + candidate.z
            
            // Sample forest density at this position
            const forestDensity = this.terrainGen.getForestDensityAtWorldPosition(worldX, worldZ)
            
            // Place tree if density exceeds threshold
            if (forestDensity > TREE_CONFIG.baseForestThreshold) {
                // Check slope - skip steep terrain
                const normal = this.terrainGen.getSurfaceNormalAtWorldPosition(worldX, worldZ)
                if (normal.y < TREE_CONFIG.maxSlopeForTrees) {
                    continue  // Too steep, skip this tree
                }
                const seed = tileX * 73856093 ^ tileZ * 19349663 ^ i * 83492791
                const treeType = this.selectTreeType(seed)
                const scale = 1 + (this.seededRandom(seed + 1) - 0.5) * 2 * TREE_CONFIG.scaleVariation
                const rotation = (this.seededRandom(seed + 2) - 0.5) * 2 * TREE_CONFIG.rotationVariation
                
                treesToPlace.push({
                    type: treeType,
                    position: new THREE.Vector3(worldX, 0, worldZ),
                    scale,
                    rotation
                })
            }
        }
        
        // Cap maximum trees per tile to prevent edge case density spikes
        treesToPlace.splice(TREE_CONFIG.maxTreesPerTile)
        
        if (treesToPlace.length === 0) return  // No trees on this tile
        
        // Group trees by type
        const treesByType = new Map<TreeTypeName, TreeInstance[]>()
        for (const tree of treesToPlace) {
            if (!treesByType.has(tree.type)) {
                treesByType.set(tree.type, [])
            }
            treesByType.get(tree.type)!.push(tree)
        }
        
        // Create InstancedMeshes per type
        const meshesPerType = new Map<TreeTypeName, THREE.InstancedMesh[]>()
        const tileKey = this.getTileCoordKey(tileX, tileZ)
        
        for (const [typeName, trees] of treesByType) {
            const geometries = this.treeGeometries.get(typeName)!
            const trunkMesh = new THREE.InstancedMesh(geometries.trunk, this.materials.trunk, trees.length)
            const foliageMesh = new THREE.InstancedMesh(geometries.foliage, this.materials.foliage, trees.length)
            
            trunkMesh.castShadow = true
            trunkMesh.receiveShadow = true
            foliageMesh.castShadow = true
            foliageMesh.receiveShadow = true
            
            const matrix = new THREE.Matrix4()
            const typeConfig = TREE_CONFIG.treeTypes[typeName]
            const trunkHeight = TREE_CONFIG.trunkHeight * typeConfig.trunkHeightMultiplier
            const foliageHeight = TREE_CONFIG.foliageHeight * typeConfig.foliageHeightMultiplier
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
            
            meshesPerType.set(typeName, [trunkMesh, foliageMesh])
        }
        
        this.treeInstancesPerTile.set(tileKey, meshesPerType)
    }

    unloadTreesForTile(tileKey: string): void {
        const meshesPerType = this.treeInstancesPerTile.get(tileKey)
        if (meshesPerType) {
            for (const meshes of meshesPerType.values()) {
                for (const mesh of meshes) {
                    this.scene.remove(mesh)
                    mesh.dispose()
                }
            }
            this.treeInstancesPerTile.delete(tileKey)
        }
    }

    dispose(): void {
        this.materials.trunk.dispose()
        this.materials.foliage.dispose()

        for (const geometries of this.treeGeometries.values()) {
            geometries.trunk.dispose()
            geometries.foliage.dispose()
        }

        for (const meshesPerType of this.treeInstancesPerTile.values()) {
            for (const meshes of meshesPerType.values()) {
                for (const mesh of meshes) {
                    mesh.dispose()
                }
            }
        }
        this.treeInstancesPerTile.clear()
    }
}
