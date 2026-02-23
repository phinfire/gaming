import { createNoise2D } from "simplex-noise";
import { domainWarp, normalize, ridgedNoise, smoothstep } from "./noise";
import alea from 'alea';
import * as THREE from 'three'
import { TERRAIN_CONFIG } from '../config'

export class TerrainGenerator {

    private noise2D = createNoise2D();
    constructor() {
        const prng = alea('woweSoRandom');
        this.noise2D = createNoise2D(prng);; 
    }

    getTerrainHeightAtWorldPosition(x: number, y: number): number {
        const warped = domainWarp(x, y, this.noise2D);
        const mask = this.mountainMask(x, y);
        const mountains = ridgedNoise(
            warped.x,
            warped.y,
            TERRAIN_CONFIG.domainWarpScale,
            TERRAIN_CONFIG.mountainsOctaves,
            TERRAIN_CONFIG.mountainsPersistence,
            TERRAIN_CONFIG.mountainsLacunarity,
            this.noise2D
        ) * TERRAIN_CONFIG.mountainsMultiplier;
        const plains = this.plainsNoise(x, y);
        const canyonFloor = this.canyonFillNoise(x, y);
        const height = plains * (1 - mask) + mountains * mask;
        const filledHeight = height * (1 - mask * TERRAIN_CONFIG.canyonFillStrength) + 
                            canyonFloor * (mask * TERRAIN_CONFIG.canyonFillStrength);
        
        return filledHeight * TERRAIN_CONFIG.heightMultiplier;
    }

    private canyonFillNoise(x: number, y: number): number {
        const fill = normalize(this.noise2D(x * 0.001, y * 0.001)) * 0.6 +
                     normalize(this.noise2D(x * 0.002, y * 0.002)) * 0.4
        return fill
    }

    private plainsNoise(x: number, y: number) {
        let n =
            TERRAIN_CONFIG.plainsWeight1 * normalize(this.noise2D(x * TERRAIN_CONFIG.plainsScale1, y * TERRAIN_CONFIG.plainsScale1)) +
            TERRAIN_CONFIG.plainsWeight2 * normalize(this.noise2D(x * TERRAIN_CONFIG.plainsScale2, y * TERRAIN_CONFIG.plainsScale2));

        return n * TERRAIN_CONFIG.plainsMultiplier;
    }

    private mountainMask(x: number, y: number) {
        let n = normalize(this.noise2D(x * TERRAIN_CONFIG.mountainMaskScale, y * TERRAIN_CONFIG.mountainMaskScale));
        n = Math.pow(n, TERRAIN_CONFIG.mountainMaskPower);
        return smoothstep(TERRAIN_CONFIG.mountainMaskSmoothstepLow, TERRAIN_CONFIG.mountainMaskSmoothstepHigh, n);
    }

    getForestDensityAtWorldPosition(x: number, y: number): number {
        const density1 = normalize(this.noise2D(x * 0.002, y * 0.002))
        const density2 = normalize(this.noise2D(x * 0.008, y * 0.008))
        return density1 * 0.7 + density2 * 0.3
    }

    getSurfaceNormalAtWorldPosition(x: number, z: number, sampleDistance: number = 2): THREE.Vector3 {
        const h0 = this.getTerrainHeightAtWorldPosition(x, z)
        const hX = this.getTerrainHeightAtWorldPosition(x + sampleDistance, z)
        const hZ = this.getTerrainHeightAtWorldPosition(x, z + sampleDistance)  
        const edgeX = new THREE.Vector3(sampleDistance, hX - h0, 0)
        const edgeZ = new THREE.Vector3(0, hZ - h0, sampleDistance)
        return new THREE.Vector3().crossVectors(edgeZ, edgeX).normalize()
    }
}