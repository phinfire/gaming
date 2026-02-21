import * as THREE from 'three'
import { TERRAIN_CONFIG } from '../config'

const TEXTURE_PATHS = {
    ground: '/gaming/textures/ground/Ground103_2K-PNG_Color.png',
    groundNormal: '/gaming/textures/ground/Ground103_2K-PNG_NormalGL.png',

    grass: '/gaming/textures/grass/Grass001_2K-PNG_Color.png',
    grassNormal: '/gaming/textures/grass/Grass001_2K-PNG_NormalGL.png',

    rock: '/gaming/textures/rock/Rock058_2K-PNG_Color.png',
    rockNormal: '/gaming/textures/rock/Rock058_2K-PNG_NormalGL.png',

    snow: '/gaming/textures/snow/Snow014_2K-PNG_Color.png',
    snowNormal: '/gaming/textures/snow/Snow014_2K-PNG_NormalGL.png'
}

export class TextureManager {
    private textureLoader: THREE.TextureLoader
    private loadedTextures: { [key: string]: THREE.Texture } = {}
    private texturesLoaded = false

    constructor() {
        this.textureLoader = new THREE.TextureLoader()
    }

    async loadTextures(): Promise<void> {
        if (TERRAIN_CONFIG.textureBlendingEnabled) {
            try {
                const textureNames = Object.keys(TEXTURE_PATHS) as Array<keyof typeof TEXTURE_PATHS>
                console.log('[TextureManager] Starting to load textures:', textureNames)
                const promises = textureNames.map(name =>
                    this.textureLoader.loadAsync(TEXTURE_PATHS[name]).then(texture => {
                        texture.wrapS = THREE.RepeatWrapping
                        texture.wrapT = THREE.RepeatWrapping
                        texture.colorSpace = name.includes('Normal') ? THREE.NoColorSpace : THREE.SRGBColorSpace
                        this.loadedTextures[name] = texture
                        console.log('[TextureManager] Loaded:', name)
                    })
                )
                await Promise.all(promises)
                this.texturesLoaded = true
                console.log('[TextureManager] All textures loaded successfully')
            } catch (error) {
                console.warn('[TextureManager] Failed to load textures, falling back to vertex colors', error)
                this.texturesLoaded = false
            }
        }
    }

    isLoaded(): boolean {
        return this.texturesLoaded
    }

    createTerrainMaterial(): THREE.Material {
        if (!TERRAIN_CONFIG.textureBlendingEnabled || !this.texturesLoaded) {
            return new THREE.MeshStandardMaterial({
                vertexColors: true,
                metalness: 0.0,
                roughness: 0.95
            })
        }

        const material = new THREE.MeshStandardMaterial({
            map: this.loadedTextures['ground'],
            normalMap: this.loadedTextures['groundNormal'],
            metalness: 0.05,
            roughness: 0.85
        })

        material.onBeforeCompile = (shader) => {

            shader.uniforms.rockMap = { value: this.loadedTextures['rock'] }
            shader.uniforms.rockNormalMap = { value: this.loadedTextures['rockNormal'] }

            shader.uniforms.heightStart = { value: TERRAIN_CONFIG.rockHeightMin }
            shader.uniforms.heightEnd = { value: TERRAIN_CONFIG.rockHeightMax }
            shader.uniforms.slopeThreshold = { value: TERRAIN_CONFIG.slopeThreshold }

            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>', `#include <common>
                varying vec3 vWorldPosition;
                varying vec3 vGeometryNormal;
                `
            )

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',

                `#include <worldpos_vertex>
                vWorldPosition = worldPosition.xyz;
                vGeometryNormal = normalize(mat3(modelMatrix) * normal);`
            )
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',

                `#include <common>
                uniform sampler2D rockMap;
                uniform sampler2D rockNormalMap;
                uniform float heightStart;
                uniform float heightEnd;
                uniform float slopeThreshold;
                varying vec3 vWorldPosition;
                varying vec3 vGeometryNormal;
                float heightBlendFactor;
                float slopeBlendFactor;
                float totalBlendFactor;`
                )
            shader.fragmentShader = shader.fragmentShader.replace(
                'vec4 diffuseColor = vec4( diffuse, opacity );',

                `vec4 diffuseColor = vec4( diffuse, opacity );
                heightBlendFactor = smoothstep(heightStart, heightEnd, vWorldPosition.y);
                slopeBlendFactor = 1.0 - smoothstep(0.0, slopeThreshold, vGeometryNormal.y);
                totalBlendFactor = max(heightBlendFactor, slopeBlendFactor);
                `
            )
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',

                `vec4 groundColor = texture2D(map, vMapUv);
                vec4 rockColor = texture2D(rockMap, vMapUv);
                vec4 blendedColor = mix(groundColor, rockColor, totalBlendFactor);
                diffuseColor *= blendedColor;`
            )

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <normal_fragment_maps>',

                `vec3 groundNormal = texture2D(normalMap, vMapUv).xyz * 2.0 - 1.0;
                vec3 rockNormalTex = texture2D(rockNormalMap, vMapUv).xyz * 2.0 - 1.0;
                vec3 blendedNormalTex = mix(groundNormal, rockNormalTex, totalBlendFactor);
                normal = normalize(tbn * blendedNormalTex);`
            )
        }

        return material
    }
}
