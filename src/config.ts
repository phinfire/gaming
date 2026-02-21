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
    snowHeightMin: 35,              // Snow starts blending in here
    snowHeightMax: 50,              // Full snow at this height
    textureRepeatPerUnit: 0.2      // How many texture repeats per 1 unit
}

// Tree generation parameters
export const TREE_CONFIG = {
    // Trunk
    trunkRadiusBottom: 0.3,
    trunkRadiusTop: 0.4,
    trunkHeight: 3,
    trunkSegments: 8,
    trunkColor: 0x8b4513,
    
    // Foliage
    foliageRadius: 2,
    foliageHeight: 4,
    foliageSegments: 8,
    foliageColor: 0x228b22,
    
    // Noise-based placement
    candidatePositionsPerTile: 160,  // number of random positions to test per tile
    forestDensityScale: 0.04,       // noise scale for forest density variation
    baseForestThreshold: 0.3,       // min noise value to place a tree (0-1)
    maxTreesPerTile: 50,             // cap on trees per tile to prevent clustering disasters
    maxSlopeForTrees: 0.7,           // min Y component of surface normal (steeper = higher value skipped)
    
    // Tree type variants (procedural)
    treeTypes: {
        tallSkinny: {
            name: 'Tall Skinny',
            trunkHeightMultiplier: 1.2,
            trunkRadiusMultiplier: 0.8,
            foliageRadiusMultiplier: 0.85,
            foliageHeightMultiplier: 1.1,
            weight: 0.4  // distribution weight
        },
        shortFat: {
            name: 'Short Fat',
            trunkHeightMultiplier: 0.8,
            trunkRadiusMultiplier: 1.3,
            foliageRadiusMultiplier: 1.2,
            foliageHeightMultiplier: 0.9,
            weight: 0.35
        },
        medium: {
            name: 'Medium',
            trunkHeightMultiplier: 1.0,
            trunkRadiusMultiplier: 1.0,
            foliageRadiusMultiplier: 1.0,
            foliageHeightMultiplier: 1.0,
            weight: 0.25
        }
    },
    
    scaleVariation: 0.15,       // ±15% scale variation
    rotationVariation: 0.15,    // ±8.6 degrees rotation variation
    positionJitter: 0.5         // units of positional jitter
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
