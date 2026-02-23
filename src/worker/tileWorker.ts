import { TerrainGenerator } from '../generation/terrain'
import { TREE_CONFIG, TILE_CONFIG } from '../config'

interface TileGenerationRequest {
    key: string
    tileSize: number
    segments: number
    worldX: number
    worldZ: number
    tileX: number
    tileZ: number
}

interface TreeData {
    x: number
    z: number
    scale: number
    rotation: number
}

interface TileGenerationResponse {
    key: string
    heights: Float32Array
    trees: TreeData[]
}

const terrainGen = new TerrainGenerator()

function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
}

function hash2D(x: number, y: number, offset: number = 0): number {
    const seed = x * 73856093 ^ y * 19349663 ^ offset * 83492791
    return seededRandom(seed)
}

function generateTreesForTile(tileX: number, tileZ: number): TreeData[] {
    const trees: TreeData[] = []
    const tileWorldX = tileX * TILE_CONFIG.tileSize
    const tileWorldZ = tileZ * TILE_CONFIG.tileSize
    
    const candidates: { x: number; z: number }[] = []
    for (let i = 0; i < TREE_CONFIG.candidatePositionsPerTile; i++) {
        const randX = hash2D(tileX, tileZ, i * 2) * TILE_CONFIG.tileSize - TILE_CONFIG.tileSize / 2
        const randZ = hash2D(tileX, tileZ, i * 2 + 1) * TILE_CONFIG.tileSize - TILE_CONFIG.tileSize / 2
        
        candidates.push({ x: randX, z: randZ })
    }
    
    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]
        const worldX = tileWorldX + candidate.x
        const worldZ = tileWorldZ + candidate.z
        const forestDensity = terrainGen.getForestDensityAtWorldPosition(worldX, worldZ)
        if (forestDensity > TREE_CONFIG.baseForestThreshold) {
            const normal = terrainGen.getSurfaceNormalAtWorldPosition(worldX, worldZ)
            if (normal.y < TREE_CONFIG.maxSlopeForTrees) {
                continue
            }
            const seed = tileX * 73856093 ^ tileZ * 19349663 ^ i * 83492791
            const scale = 1 + (seededRandom(seed + 1) - 0.5) * 2 * TREE_CONFIG.scaleVariation
            const rotation = (seededRandom(seed + 2) - 0.5) * 2 * TREE_CONFIG.rotationVariation
            
            trees.push({
                x: worldX,
                z: worldZ,
                scale,
                rotation
            })
        }
    }
    
    trees.splice(TREE_CONFIG.maxTreesPerTile)
    return trees
}

self.onmessage = (event: MessageEvent<TileGenerationRequest>) => {
    const { key, tileSize, segments, worldX, worldZ, tileX, tileZ } = event.data

    const heights = new Float32Array((segments + 1) * (segments + 1))
    let index = 0

    for (let y = 0; y <= segments; y++) {
        for (let x = 0; x <= segments; x++) {
            const localX = (x / segments) * tileSize - tileSize / 2
            const localZ = (y / segments) * tileSize - tileSize / 2

            const worldPosX = worldX + localX
            const worldPosZ = worldZ + localZ

            heights[index] = terrainGen.getTerrainHeightAtWorldPosition(worldPosX, worldPosZ)
            index++
        }
    }

    const trees = generateTreesForTile(tileX, tileZ)

    const response: TileGenerationResponse = { key, heights, trees }
    ;(self as any).postMessage(response, [heights.buffer])
}
