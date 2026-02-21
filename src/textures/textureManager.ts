import * as THREE from 'three'
import { TERRAIN_CONFIG } from '../config'

const TEXTURE_PATHS = {
    ground: '/gaming/textures/ground/Ground103_2K-PNG_Color.png',
    groundNormal: '/gaming/textures/ground/Ground103_2K-PNG_NormalGL.png',
    groundRoughness: '/gaming/textures/ground/Ground103_2K-PNG_Roughness.png',

    grass: '/gaming/textures/grass/Grass001_2K-PNG_Color.png',
    grassNormal: '/gaming/textures/grass/Grass001_2K-PNG_NormalGL.png',
    grassRoughness: '/gaming/textures/grass/Grass001_2K-PNG_Roughness.png',

    rock: '/gaming/textures/rock/Rock058_2K-PNG_Color.png',
    rockNormal: '/gaming/textures/rock/Rock058_2K-PNG_NormalGL.png',
    rockRoughness: '/gaming/textures/rock/Rock058_2K-PNG_Roughness.png',

    snow: '/gaming/textures/snow/Snow014_2K-PNG_Color.png',
    snowNormal: '/gaming/textures/snow/Snow014_2K-PNG_NormalGL.png',
    snowRoughness: '/gaming/textures/snow/Snow014_2K-PNG_Roughness.png'
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
            shader.uniforms.rockRoughnessMap = { value: this.loadedTextures['rockRoughness'] }
            shader.uniforms.grassMap = { value: this.loadedTextures['grass'] }
            shader.uniforms.grassNormalMap = { value: this.loadedTextures['grassNormal'] }
            shader.uniforms.grassRoughnessMap = { value: this.loadedTextures['grassRoughness'] }
            shader.uniforms.snowMap = { value: this.loadedTextures['snow'] }
            shader.uniforms.snowNormalMap = { value: this.loadedTextures['snowNormal'] }
            shader.uniforms.snowRoughnessMap = { value: this.loadedTextures['snowRoughness'] }
            shader.uniforms.groundRoughnessMap = { value: this.loadedTextures['groundRoughness'] }

            shader.uniforms.heightStart = { value: TERRAIN_CONFIG.rockHeightMin }
            shader.uniforms.heightEnd = { value: TERRAIN_CONFIG.rockHeightMax }
            shader.uniforms.snowHeightStart = { value: TERRAIN_CONFIG.snowHeightMin }
            shader.uniforms.snowHeightEnd = { value: TERRAIN_CONFIG.snowHeightMax }
            shader.uniforms.slopeThreshold = { value: TERRAIN_CONFIG.slopeThreshold }
            shader.uniforms.groundNoiseScale = { value: TERRAIN_CONFIG.groundNoiseScale }

            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>', `#include <common>
                uniform float groundNoiseScale;
                varying vec3 vWorldPosition;
                varying vec3 vGeometryNormal;
                varying float vGroundNoiseBlend;
                
                // Simple 2D noise function
                float noise(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                float smoothNoise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    return mix(
                        mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x),
                        mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x),
                        f.y
                    );
                }
                
                float fbm(vec2 p) {
                    float value = 0.0;
                    float amplitude = 1.0;
                    float frequency = 1.0;
                    float maxValue = 0.0;
                    
                    for(int i = 0; i < 5; i++) {
                        value += amplitude * smoothNoise(p * frequency);
                        maxValue += amplitude;
                        amplitude *= 0.5;
                        frequency *= 2.0;
                    }
                    
                    return value / maxValue;
                }
                `
            )

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',

                `#include <worldpos_vertex>
                vWorldPosition = worldPosition.xyz;
                vGeometryNormal = normalize(mat3(modelMatrix) * normal);
                float groundNoise = fbm(vWorldPosition.xz * groundNoiseScale);
                vGroundNoiseBlend = smoothstep(0.40, 0.50, groundNoise);`
            )
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',

                `#include <common>
                uniform sampler2D rockMap;
                uniform sampler2D rockNormalMap;
                uniform sampler2D rockRoughnessMap;
                uniform sampler2D grassMap;
                uniform sampler2D grassNormalMap;
                uniform sampler2D grassRoughnessMap;
                uniform sampler2D snowMap;
                uniform sampler2D snowNormalMap;
                uniform sampler2D snowRoughnessMap;
                uniform sampler2D groundRoughnessMap;
                uniform float heightStart;
                uniform float heightEnd;
                uniform float snowHeightStart;
                uniform float snowHeightEnd;
                uniform float slopeThreshold;
                varying vec3 vWorldPosition;
                varying vec3 vGeometryNormal;
                varying float vGroundNoiseBlend;
                float rockHeightBlend;
                float snowHeightBlend;
                float slopeBlend;
                float finalRoughness;`
                )
            shader.fragmentShader = shader.fragmentShader.replace(
                'vec4 diffuseColor = vec4( diffuse, opacity );',

                `vec4 diffuseColor = vec4( diffuse, opacity );
                rockHeightBlend = smoothstep(heightStart, heightEnd, vWorldPosition.y);
                snowHeightBlend = smoothstep(snowHeightStart, snowHeightEnd, vWorldPosition.y);
                slopeBlend = 1.0 - smoothstep(0.0, slopeThreshold, vGeometryNormal.y);
                `
            )
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',

                `vec4 groundColor = texture2D(map, vMapUv);
                vec4 grassColor = texture2D(grassMap, vMapUv);
                vec4 rockColor = texture2D(rockMap, vMapUv);
                vec4 snowColor = texture2D(snowMap, vMapUv);
                vec4 lowGroundColor = mix(groundColor, grassColor, vGroundNoiseBlend);
                vec4 blendedColor = mix(lowGroundColor, rockColor, rockHeightBlend);
                blendedColor = mix(blendedColor, snowColor, snowHeightBlend);
                blendedColor = mix(blendedColor, rockColor, slopeBlend);
                diffuseColor *= blendedColor;
                
                float groundRoughness = texture2D(groundRoughnessMap, vMapUv).g;
                float grassRoughness = texture2D(grassRoughnessMap, vMapUv).g;
                float rockRoughness = texture2D(rockRoughnessMap, vMapUv).g;
                float snowRoughness = texture2D(snowRoughnessMap, vMapUv).g;
                float lowGroundRoughness = mix(groundRoughness, grassRoughness, vGroundNoiseBlend);
                finalRoughness = mix(lowGroundRoughness, rockRoughness, rockHeightBlend);
                finalRoughness = mix(finalRoughness, snowRoughness, snowHeightBlend);
                finalRoughness = mix(finalRoughness, rockRoughness, slopeBlend);`
            )

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <normal_fragment_maps>',

                `vec3 groundNormal = texture2D(normalMap, vMapUv).xyz * 2.0 - 1.0;
                vec3 grassNormalTex = texture2D(grassNormalMap, vMapUv).xyz * 2.0 - 1.0;
                vec3 rockNormalTex = texture2D(rockNormalMap, vMapUv).xyz * 2.0 - 1.0;
                vec3 snowNormalTex = texture2D(snowNormalMap, vMapUv).xyz * 2.0 - 1.0;
                vec3 lowGroundNormal = mix(groundNormal, grassNormalTex, vGroundNoiseBlend);
                vec3 blendedNormalTex = mix(lowGroundNormal, rockNormalTex, rockHeightBlend);
                blendedNormalTex = mix(blendedNormalTex, snowNormalTex, snowHeightBlend);
                blendedNormalTex = mix(blendedNormalTex, rockNormalTex, slopeBlend);
                normal = normalize(tbn * blendedNormalTex);`
            )
            
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughness_fragment>',
                
                `roughnessFactor = finalRoughness;
                #include <roughness_fragment>`
            )
        }

        return material
    }
}
