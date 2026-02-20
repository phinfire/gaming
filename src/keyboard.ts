export const inputState = {
    keys: { w: false, a: false, s: false, d: false },
}

export const debugState = {
    terrainLoadingEnabled: true,
}

export function setupInputHandlers() {
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase()
        
        // Movement keys
        if (key in inputState.keys) {
            inputState.keys[key as keyof typeof inputState.keys] = true
        }
        
        // Debug toggles
        if (key === 'p') {
            debugState.terrainLoadingEnabled = !debugState.terrainLoadingEnabled
            console.log(`[Debug] Terrain loading ${debugState.terrainLoadingEnabled ? 'RESUMED' : 'PAUSED'}`)
        }
    })

    document.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() in inputState.keys) {
            inputState.keys[e.key.toLowerCase() as keyof typeof inputState.keys] = false
        }
    })
}
