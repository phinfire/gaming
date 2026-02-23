
import * as THREE from 'three'
import { TERRAIN_CONFIG, TILE_CONFIG } from "../config"
import type { TextureManager } from '../textures/textureManager'
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';
import { fbm as fbmNoise, smoothstep } from './noise';

export function createGroundPlaneFromHeights(textureManager: TextureManager, xPos: number, yPos: number, zPos: number, heights: Float32Array, segments: number): THREE.Mesh {
    const geometry = new THREE.BufferGeometry()
    const tileSize = TILE_CONFIG.tileSize
    const segmentSize = tileSize / segments

    const positions = new Float32Array((segments + 1) * (segments + 1) * 3)
    const blendWeights = new Float32Array((segments + 1) * (segments + 1) * 4)
    let posIndex = 0
    let blendIndex = 0

    const prng = alea('woweSoRandom');
    const noise2D = createNoise2D(prng);

    for (let z = 0; z <= segments; z++) {
        for (let x = 0; x <= segments; x++) {
            let localX = x * segmentSize - tileSize / 2;
            let localZ = z * segmentSize - tileSize / 2;
            const edgeSnapTolerance = 0.5;
            if (Math.abs(localX - (-tileSize / 2)) < edgeSnapTolerance) localX = -tileSize / 2;
            if (Math.abs(localX - (tileSize / 2)) < edgeSnapTolerance) localX = tileSize / 2;
            if (Math.abs(localZ - (-tileSize / 2)) < edgeSnapTolerance) localZ = -tileSize / 2;
            if (Math.abs(localZ - (tileSize / 2)) < edgeSnapTolerance) localZ = tileSize / 2;

            const worldX = localX + xPos;
            const worldZ = localZ + zPos;

            positions[posIndex++] = localX;
            positions[posIndex++] = 0;
            positions[posIndex++] = localZ;

            let fertilityNoise = fbmNoise(worldX * 0.008, worldZ * 0.008, noise2D, 4, 2, 0.5);
            fertilityNoise = (fertilityNoise + 1) * 0.5;
            
            let temperatureNoise = fbmNoise(worldX * 0.001, worldZ * 0.001, noise2D, 4, 2, 0.5);
            temperatureNoise = (temperatureNoise + 1) * 0.5;
            
            let humidityNoise = fbmNoise(worldX * 0.005, worldZ * 0.005, noise2D, 4, 2, 0.5);
            humidityNoise = (humidityNoise + 1) * 0.5;
            
            // Pack into vec4: x=temperature, y=humidity, z=unused, w=fertility
            blendWeights[blendIndex++] = temperatureNoise; // x
            blendWeights[blendIndex++] = humidityNoise;    // y
            blendWeights[blendIndex++] = 0.0;              // z (unused)
            blendWeights[blendIndex++] = smoothstep(0.2,0.4,fertilityNoise);   // w (fertility)
        }
    }
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
    geometry.setAttribute('blendWeights', new THREE.BufferAttribute(blendWeights, 4))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
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

    // Don't set vertex colors - use custom attribute instead

    const material = textureManager.createTerrainMaterial()

    const ground = new THREE.Mesh(geometry, material)
    ground.position.x = xPos
    ground.position.y = yPos
    ground.position.z = zPos
    ground.receiveShadow = true

    return ground
}