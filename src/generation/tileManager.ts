import * as THREE from 'three'
import { TerrainGenerator } from './terrain'
import { ConifersTreeGenerator } from './treeGenerator'
import { TextureManager } from '../textures/textureManager'
import { TERRAIN_CONFIG, TILE_CONFIG } from '../config'
import { debugState } from '../keyboard'

interface TileCoord {
    x: number
    z: number
}

interface PendingTile {
    key: string
    tileX: number
    tileZ: number
    lodLevel: number
    segments: number
}

export class TileManager {

    private loadedTiles = new Map<string, { mesh: THREE.Mesh; lodLevel: number }>()
    private pendingTiles = new Map<string, PendingTile>()
    private pendingLODReplacements = new Map<string, { oldMesh: THREE.Mesh; oldLodLevel: number }>()
    private cachedMeshes = new Map<string, { mesh: THREE.Mesh; lodLevel: number; timestamp: number }>()
    private tilesWithTrees = new Set<string>()
    private workerQueue: Array<{ key: string; tileSize: number; segments: number; worldX: number; worldZ: number }> = []
    private deferredTreeScatters: Array<{ tile: THREE.Mesh; tileX: number; tileZ: number }> = []
    private scene: THREE.Scene
    private worker: Worker
    private terrainGen: TerrainGenerator
    private treeGenerator: ConifersTreeGenerator
    private textureManager: TextureManager
    private maxWorkerMessagesPerFrame = 4
    private maxWorkerMessagesPerFrameInitial = 16
    private isInitialLoad = true
    private initialLoadThreshold = 25

    constructor(scene: THREE.Scene) {
        this.scene = scene
        this.terrainGen = new TerrainGenerator()
        this.treeGenerator = new ConifersTreeGenerator(scene, this.terrainGen, 0, 0)
        this.textureManager = new TextureManager()
        this.worker = new Worker(new URL('../worker/tileWorker.ts', import.meta.url), { type: 'module' })
        this.setupWorkerListener()
        this.textureManager.loadTextures()
    }

    private setupWorkerListener() {
        this.worker.onmessage = (event) => {
            const { key, heights } = event.data
            const pending = this.pendingTiles.get(key)
            if (pending) {
                const tile = this.createGroundPlaneFromHeights(
                    pending.tileX * TILE_CONFIG.tileSize,
                    0,
                    pending.tileZ * TILE_CONFIG.tileSize,
                    heights,
                    pending.segments
                )
                this.scene.add(tile)
                const replacement = this.pendingLODReplacements.get(key)
                if (replacement) {
                    this.scene.remove(replacement.oldMesh)
                    // Don't touch trees - they're independent of LOD
                    this.pendingLODReplacements.delete(key)
                } else {
                    // Only scatter trees on initial tile creation, not on LOD updates
                    if (!this.tilesWithTrees.has(key)) {
                        this.deferredTreeScatters.push({ tile, tileX: pending.tileX, tileZ: pending.tileZ })
                        this.tilesWithTrees.add(key)
                    }
                }
                
                this.loadedTiles.set(key, { mesh: tile, lodLevel: pending.lodLevel })
                this.pendingTiles.delete(key)
            }
        }
    }

    private processDeferredTreeScatters() {
        if (this.deferredTreeScatters.length === 0) return
        
        requestIdleCallback(() => {
            // Process up to 2 deferred scatters per idle period
            for (let i = 0; i < Math.min(2, this.deferredTreeScatters.length); i++) {
                const { tile, tileX, tileZ } = this.deferredTreeScatters.shift()!
                this.treeGenerator.scatterTreesOnTile(tile, tileX, tileZ)
            }
        }, { timeout: 100 })
    }

    private getTileCoordKey(x: number, z: number): string {
        return `${x},${z}`
    }

    private getTileCoordFromWorldPos(worldX: number, worldZ: number): TileCoord {
        return {
            x: Math.floor(worldX / TILE_CONFIG.tileSize),
            z: Math.floor(worldZ / TILE_CONFIG.tileSize)
        }
    }

    private calculateTileLOD(tileX: number, tileZ: number, cameraTile: TileCoord): number {
        const dx = Math.abs(tileX - cameraTile.x)
        const dz = Math.abs(tileZ - cameraTile.z)
        const distance = Math.max(dx, dz) // Chebyshev distance

        if (distance <= TILE_CONFIG.lodNearDistance) return 0
        if (distance <= TILE_CONFIG.lodMidDistance) return 1
        return 2
    }

    private evictLRUFromCache(): void {
        if (this.cachedMeshes.size >= TILE_CONFIG.meshCacheMaxSize) {
            let oldestKey = ''
            let oldestTime = Infinity
            
            for (const [key, data] of this.cachedMeshes) {
                if (data.timestamp < oldestTime) {
                    oldestTime = data.timestamp
                    oldestKey = key
                }
            }
            
            if (oldestKey) {
                this.cachedMeshes.delete(oldestKey)
            }
        }
    }

    private tryGetFromCache(key: string, lodLevel: number): THREE.Mesh | null {
        const cached = this.cachedMeshes.get(key)
        if (cached && cached.lodLevel === lodLevel) {
            // Update timestamp for LRU
            cached.timestamp = Date.now()
            return cached.mesh
        }
        return null
    }

    private createGroundPlaneFromHeights(xPos: number, yPos: number, zPos: number, heights: Float32Array, segments: number): THREE.Mesh {
        // Create geometry directly in XZ plane (no rotation needed)
        const geometry = new THREE.BufferGeometry()
        const tileSize = TILE_CONFIG.tileSize
        const segmentSize = tileSize / segments
        
        const positions = new Float32Array((segments + 1) * (segments + 1) * 3)
        let posIndex = 0
        
        for (let z = 0; z <= segments; z++) {
            for (let x = 0; x <= segments; x++) {
                // Snap edge vertices to quarter-positions for seamless LOD transitions
                let xPos = x * segmentSize - tileSize / 2
                let zPos = z * segmentSize - tileSize / 2
                
                // Snap edges to prevent seams (within 0.5 unit tolerance)
                const edgeSnapTolerance = 0.5
                if (Math.abs(xPos - (-tileSize / 2)) < edgeSnapTolerance) xPos = -tileSize / 2
                if (Math.abs(xPos - (tileSize / 2)) < edgeSnapTolerance) xPos = tileSize / 2
                if (Math.abs(zPos - (-tileSize / 2)) < edgeSnapTolerance) zPos = -tileSize / 2
                if (Math.abs(zPos - (tileSize / 2)) < edgeSnapTolerance) zPos = tileSize / 2
                
                positions[posIndex++] = xPos
                positions[posIndex++] = 0
                positions[posIndex++] = zPos
            }
        }
        
        // Create indices for triangle faces
        const indices = new Uint32Array(segments * segments * 6)
        let indexIndex = 0
        for (let z = 0; z < segments; z++) {
            for (let x = 0; x < segments; x++) {
                const a = z * (segments + 1) + x
                const b = z * (segments + 1) + x + 1
                const c = (z + 1) * (segments + 1) + x
                const d = (z + 1) * (segments + 1) + x + 1
                
                indices[indexIndex++] = a
                indices[indexIndex++] = c
                indices[indexIndex++] = b
                indices[indexIndex++] = b
                indices[indexIndex++] = c
                indices[indexIndex++] = d
            }
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setIndex(new THREE.BufferAttribute(indices, 1))
        
        // Add UV coordinates for texture mapping
        const uvs = new Float32Array((segments + 1) * (segments + 1) * 2)
        const textureRepeatScale = TILE_CONFIG.tileSize * TERRAIN_CONFIG.textureRepeatPerUnit
        let uvIndex = 0
        for (let z = 0; z <= segments; z++) {
            for (let x = 0; x <= segments; x++) {
                uvs[uvIndex++] = (x / segments) * textureRepeatScale
                uvs[uvIndex++] = (z / segments) * textureRepeatScale
            }
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
        
        // Apply heights
        const positionAttribute = geometry.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < positionAttribute.count; i++) {
            positionAttribute.setY(i, heights[i])
        }
        positionAttribute.needsUpdate = true
        geometry.computeVertexNormals()
        
        // Set vertex colors
        const colors = new Float32Array(positionAttribute.count * 3)
        const grassColor = new THREE.Color(TERRAIN_CONFIG.grassColor)
        
        for (let i = 0; i < positionAttribute.count; i++) {
            colors[i * 3] = grassColor.r
            colors[i * 3 + 1] = grassColor.g
            colors[i * 3 + 2] = grassColor.b
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        
        const material = this.textureManager.createTerrainMaterial()
        
        const ground = new THREE.Mesh(geometry, material)
        ground.position.x = xPos
        ground.position.y = yPos
        ground.position.z = zPos
        ground.receiveShadow = true
        
        return ground
    }

    update(cameraWorldPos: THREE.Vector3) {
        if (!debugState.terrainLoadingEnabled) {
            return
        }
        
        const cameraTile = this.getTileCoordFromWorldPos(cameraWorldPos.x, cameraWorldPos.z)
        const tilesToLoad = new Set<string>()

        for (let x = cameraTile.x - TILE_CONFIG.renderDistance; x <= cameraTile.x + TILE_CONFIG.renderDistance; x++) {
            for (let z = cameraTile.z - TILE_CONFIG.renderDistance; z <= cameraTile.z + TILE_CONFIG.renderDistance; z++) {
                tilesToLoad.add(this.getTileCoordKey(x, z))
            }
        }
        for (const [key, data] of this.loadedTiles) {
            if (!tilesToLoad.has(key)) {
                this.scene.remove(data.mesh)
                // Cache the mesh instead of discarding it
                this.cachedMeshes.set(key, { mesh: data.mesh, lodLevel: data.lodLevel, timestamp: Date.now() })
                this.evictLRUFromCache()
                this.loadedTiles.delete(key)
                this.treeGenerator.unloadTreesForTile(key)
                this.tilesWithTrees.delete(key)  // Reset so trees can be scattered again if tile reloads
            }
        }
        for (const key of tilesToLoad) {
            const [x, z] = key.split(',').map(Number)
            const lodLevel = this.calculateTileLOD(x, z, cameraTile)
            const loadedData = this.loadedTiles.get(key) 
            
            // Handle LOD changes for existing tiles
            if (loadedData && loadedData.lodLevel !== lodLevel && !this.pendingLODReplacements.has(key) && !this.pendingTiles.has(key)) {
                this.pendingLODReplacements.set(key, { oldMesh: loadedData.mesh, oldLodLevel: loadedData.lodLevel })
                
                // Queue worker message to generate new LOD version (throttled)
                const worldX = x * TILE_CONFIG.tileSize
                const worldZ = z * TILE_CONFIG.tileSize
                const segments = TILE_CONFIG.lodSegments[lodLevel as keyof typeof TILE_CONFIG.lodSegments]
                this.pendingTiles.set(key, { key, tileX: x, tileZ: z, lodLevel, segments })
                this.workerQueue.push({
                    key,
                    tileSize: TILE_CONFIG.tileSize,
                    segments,
                    worldX,
                    worldZ
                })
            }
            
            // Load completely new tiles
            if (!this.loadedTiles.has(key) && !this.pendingTiles.has(key)) {
                const worldX = x * TILE_CONFIG.tileSize
                const worldZ = z * TILE_CONFIG.tileSize
                const segments = TILE_CONFIG.lodSegments[lodLevel as keyof typeof TILE_CONFIG.lodSegments]
                
                // Check if we have this mesh cached at the same LOD level
                const cachedMesh = this.tryGetFromCache(key, lodLevel)
                if (cachedMesh) {
                    // Restore from cache - trees already exist for this tile, no need to scatter again
                    this.scene.add(cachedMesh)
                    this.loadedTiles.set(key, { mesh: cachedMesh, lodLevel })
                    this.cachedMeshes.delete(key)
                } else {
                    // Queue worker message instead of posting immediately
                    this.pendingTiles.set(key, { key, tileX: x, tileZ: z, lodLevel, segments })
                    this.workerQueue.push({
                        key,
                        tileSize: TILE_CONFIG.tileSize,
                        segments,
                        worldX,
                        worldZ
                    })
                }
            }
        }
        
        // Process queued worker messages (throttled per frame)
        this.processWorkerQueue()
        
        // Process deferred tree scatter operations
        this.processDeferredTreeScatters()
    }

    private processWorkerQueue() {
        // Switch out of initial load mode once we've loaded enough tiles
        if (this.isInitialLoad && this.loadedTiles.size >= this.initialLoadThreshold) {
            this.isInitialLoad = false
            console.log('[TileManager] Switched to normal loading throttle')
        }
        
        const maxMessages = this.isInitialLoad ? this.maxWorkerMessagesPerFrameInitial : this.maxWorkerMessagesPerFrame
        const toProcess = Math.min(maxMessages, this.workerQueue.length)
        for (let i = 0; i < toProcess; i++) {
            const msg = this.workerQueue.shift()!
            this.worker.postMessage(msg)
        }
    }

    setInitialLoad(value: boolean): void {
        if (this.isInitialLoad !== value) {
            this.isInitialLoad = value
            console.log(`[TileManager] Initial load ${value ? 'enabled' : 'disabled'}`)
        }
    }
}
