import { TerrainGenerator } from '../generation/terrain'

interface TileGenerationRequest {
    key: string
    tileSize: number
    segments: number
    worldX: number
    worldZ: number
}

interface TileGenerationResponse {
    key: string
    heights: Float32Array
}

const terrainGen = new TerrainGenerator()

self.onmessage = (event: MessageEvent<TileGenerationRequest>) => {
    const { key, tileSize, segments, worldX, worldZ } = event.data

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

    const response: TileGenerationResponse = { key, heights }
    ;(self as any).postMessage(response, [heights.buffer])
}
