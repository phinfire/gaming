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
            vertexColors: false,
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
            // No need for groundNoiseScale anymore

            // Inject varyings for world position, geometry normal, and blend weights
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>', `#include <common>
                attribute vec4 blendWeights;
                varying vec3 vWorldPosition;
                varying vec3 vGeometryNormal;
                varying vec4 vBlendWeights;`
            )

            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                vWorldPosition = worldPosition.xyz;
                vGeometryNormal = normalize(mat3(modelMatrix) * normal);
                vBlendWeights = blendWeights;
                `
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
                varying vec4 vBlendWeights;
                float rockHeightBlend;
                float snowHeightBlend;
                float slopeBlend;
                float finalRoughness;
                float fertility;
                // Triplanar mapping
                vec4 triplanarSample(sampler2D tex, vec3 worldPos, vec3 normal, float scale) {
                    vec3 absNormal = abs(normal);
                    absNormal = normalize(absNormal);
                    float sum = absNormal.x + absNormal.y + absNormal.z;
                    absNormal /= sum;
                    vec4 xProj = texture2D(tex, worldPos.yz * scale);
                    vec4 yProj = texture2D(tex, worldPos.xz * scale);
                    vec4 zProj = texture2D(tex, worldPos.xy * scale);
                    return xProj * absNormal.x + yProj * absNormal.y + zProj * absNormal.z;
                }
                vec3 triplanarNormalSample(sampler2D tex, vec3 worldPos, vec3 normal, float scale) {
                    vec3 absNormal = abs(normal);
                    absNormal = normalize(absNormal);
                    float sum = absNormal.x + absNormal.y + absNormal.z;
                    absNormal /= sum;
                    vec3 xProj = texture2D(tex, worldPos.yz * scale).xyz * 2.0 - 1.0;
                    vec3 yProj = texture2D(tex, worldPos.xz * scale).xyz * 2.0 - 1.0;
                    vec3 zProj = texture2D(tex, worldPos.xy * scale).xyz * 2.0 - 1.0;
                    return normalize(xProj * absNormal.x + yProj * absNormal.y + zProj * absNormal.z);
                }`
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
                `float triplanarScale = 1.0 / 4.0;
                // Use blend weights from custom attribute
                // vBlendWeights: x=unused, y=unused, z=unused, w=fertility
                fertility = vBlendWeights.w;
                vec4 groundColor = triplanarSample(map, vWorldPosition, vGeometryNormal, triplanarScale);
                vec4 grassColor = triplanarSample(grassMap, vWorldPosition, vGeometryNormal, triplanarScale);
                vec4 rockColor = triplanarSample(rockMap, vWorldPosition, vGeometryNormal, triplanarScale);
                vec4 snowColor = triplanarSample(snowMap, vWorldPosition, vGeometryNormal, triplanarScale);
                vec4 lowGroundColor = mix(groundColor, grassColor, fertility);
                vec4 blendedColor = mix(lowGroundColor, rockColor, rockHeightBlend);
                blendedColor = mix(blendedColor, snowColor, snowHeightBlend);
                blendedColor = mix(blendedColor, rockColor, slopeBlend);
                diffuseColor *= blendedColor;
                float groundRoughness = triplanarSample(groundRoughnessMap, vWorldPosition, vGeometryNormal, triplanarScale).g;
                float grassRoughness = triplanarSample(grassRoughnessMap, vWorldPosition, vGeometryNormal, triplanarScale).g;
                float rockRoughness = triplanarSample(rockRoughnessMap, vWorldPosition, vGeometryNormal, triplanarScale).g;
                float snowRoughness = triplanarSample(snowRoughnessMap, vWorldPosition, vGeometryNormal, triplanarScale).g;
                float lowGroundRoughness = mix(groundRoughness, grassRoughness, fertility);
                finalRoughness = mix(lowGroundRoughness, rockRoughness, rockHeightBlend);
                finalRoughness = mix(finalRoughness, snowRoughness, snowHeightBlend);
                finalRoughness = mix(finalRoughness, rockRoughness, slopeBlend);`
            )

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <normal_fragment_maps>',
                `float triplanarScaleNormal = 1.0 / 4.0;
                vec3 groundNormal = triplanarNormalSample(normalMap, vWorldPosition, vGeometryNormal, triplanarScaleNormal);
                vec3 grassNormalTex = triplanarNormalSample(grassNormalMap, vWorldPosition, vGeometryNormal, triplanarScaleNormal);
                vec3 rockNormalTex = triplanarNormalSample(rockNormalMap, vWorldPosition, vGeometryNormal, triplanarScaleNormal);
                vec3 snowNormalTex = triplanarNormalSample(snowNormalMap, vWorldPosition, vGeometryNormal, triplanarScaleNormal);
                vec3 lowGroundNormal = mix(groundNormal, grassNormalTex, fertility);
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
