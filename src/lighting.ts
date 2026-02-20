import * as THREE from 'three'

export function setupEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    // Create a simple procedural sky texture
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    
    // Create a sky gradient (blue on top, lighter near horizon)
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, '#1a4d7a')      // darker blue at top
    gradient.addColorStop(0.6, '#87CEEB')    // sky blue in middle
    gradient.addColorStop(1, '#e0f6ff')      // lighter at horizon
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Convert to texture
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    
    // Use PMREMGenerator to create environment map from equirectangular texture
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const envMap = pmremGenerator.fromEquirectangular(texture)
    pmremGenerator.dispose()
    
    // Apply to scene
    scene.environment = envMap.texture
}

export function setupLighting(scene: THREE.Scene) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
    directionalLight.position.set(100, 100, 100)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 4096
    directionalLight.shadow.mapSize.height = 4096
    directionalLight.shadow.camera.left = -500
    directionalLight.shadow.camera.right = 500
    directionalLight.shadow.camera.top = 500
    directionalLight.shadow.camera.bottom = -500
    directionalLight.shadow.camera.near = 0.1
    directionalLight.shadow.camera.far = 2000
    scene.add(directionalLight)
    scene.add(directionalLight.target)

    return { ambientLight, directionalLight }
}

export function updateLighting(
    lights: { ambientLight: THREE.AmbientLight; directionalLight: THREE.DirectionalLight },
    cameraPosition: THREE.Vector3
) {
    // Keep the light offset relative to the camera so it always illuminates correctly
    // Position the light high and to the side like the sun
    const lightOffset = new THREE.Vector3(200, 200, 200)
    lights.directionalLight.position.copy(cameraPosition).add(lightOffset)
    
    // Point shadow camera at camera position
    lights.directionalLight.target.position.copy(cameraPosition)
    lights.directionalLight.target.updateMatrixWorld(true)
}