import * as THREE from 'three'

export function setupScene() {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    )
    const renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector<HTMLCanvasElement>('#canvas')!,
        antialias: true,
        alpha: true,
    })

    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true
    
    // Set tone mapping for better color grading
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0

    // Add sky blue background
    scene.background = new THREE.Color(0x87CEEB)
    
    // Add atmospheric fog
    scene.fog = new THREE.Fog(0x87CEEB, 500, 2000)

    camera.position.set(-50, 100, -50);
    camera.lookAt(0, 0, 0);

    return { scene, camera, renderer }

}