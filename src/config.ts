/**
 * Global game configuration
 */

// Terrain generation parameters
export const TERRAIN_CONFIG = {
    // Domain warp
    domainWarpScale: 0.008,
    
    // Ridged noise (mountains)
    mountainsOctaves: 5,
    mountainsPersistence: 2.0,
    mountainsLacunarity: 0.5,
    mountainsMultiplier: 2.5,
    
    // Plains noise
    plainsScale1: 0.003,
    plainsScale2: 0.01,
    plainsWeight1: 0.7,
    plainsWeight2: 0.3,
    plainsMultiplier: 0.5,
    
    // Mountain mask
    mountainMaskScale: 0.002,
    mountainMaskPower: 2.0,
    mountainMaskSmoothstepLow: 0.4,
    mountainMaskSmoothstepHigh: 0.65,    
    // Canyon fill (prevents internal canyons from being too deep)
    canyonFillStrength: 0.3,  // 0 = no fill, 1 = completely levels canyons    
    // Height scaling
    heightMultiplier: 50,
    
    // Terrain texturing
    grassColor: 0x3d7d3d,           // Grass green
    rockColor: 0x888888,            // Rock gray
    slopeThreshold: 0.7,            // Normal.y threshold: above = grass, below = rock
    
    // Height-based texture blending
    textureBlendingEnabled: true,
    grassHeightMax: 20,             // Transition from grass to rock at this height
    rockHeightMin: 20,              // Rock starts blending in here
    rockHeightMax: 40,              // Full rock at this height
    snowHeightMin: 60,              // Snow starts blending in here
    snowHeightMax: 75,              // Full snow at this height
    textureRepeatPerUnit: 0.2,      // How many texture repeats per 1 unit
    groundNoiseScale: 0.01           // Scale of ground/grass noise variation
}

// Tree generation parameters
export const TREE_CONFIG = {
    // Base trunk
    trunkRadiusBottom: 0.3,
    trunkRadiusTop: 0.4,
    trunkHeight: 3,
    trunkSegments: 8,
    trunkColor: 0x5A3A1E,
    
    // Base foliage
    foliageRadius: 2,
    foliageHeight: 4,
    foliageSegments: 8,
    foliageColor: 0x1D4731,
    
    // Noise-based placement
    candidatePositionsPerTile: 160,  // number of random positions to test per tile
    forestDensityScale: 0.04,       // noise scale for forest density variation
    baseForestThreshold: 0.3,       // min noise value to place a tree (0-1)
    maxTreesPerTile: 50,             // cap on trees per tile to prevent clustering disasters
    maxSlopeForTrees: 0.7,           // min Y component of surface normal (steeper = higher value skipped)
    
    // Per-instance variation
    scaleVariation: 0.15,            // ±15% scale variation per tree
    rotationVariation: 0.15,         // ±8.6 degrees rotation variation per tree
    positionJitter: 0.5              // units of positional jitter
}

export const TILE_CONFIG = {
    // Tile dimensions
    tileSize: 100,
    
    // Rendering
    renderDistance: 16,
    
    // Level of Detail
    lodNearDistance: 6,
    lodMidDistance: 12,
    lodSegments: {
        0: 100,
        1: 50,
        2: 25
    },
    
    // Mesh caching for efficient backtracking
    meshCacheMaxSize: 64
}
