import * as THREE from 'three'

export function setupResizeHandler(camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    window.addEventListener('resize', () => {
        const width = window.innerWidth
        const height = window.innerHeight
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
    })
}
