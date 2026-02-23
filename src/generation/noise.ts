
export function fbm(x: number, y: number, noise2D: (x: number, y: number) => number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
        value += amplitude * noise2D(x * frequency, y * frequency);
        maxValue += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value / maxValue;
}
export function normalize(n: number) {
    return (n + 1) * 0.5;
}

export function ridgedNoise(x: number, y: number, frequency: number, octaves: number, lacunarity: number, gain: number, noise2D: (x: number, y: number) => number) {
    let amplitude = 1;
    let sum = 0;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
        let n = noise2D(x * frequency, y * frequency);
        n = 1.0 - Math.abs(n);
        n *= n;
        sum += n * amplitude;
        maxAmp += amplitude;
        frequency *= lacunarity;
        amplitude *= gain;
    }
    return sum / maxAmp;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
    let t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

export function domainWarp(x: number, y: number, noise2D: (x: number, y: number) => number) {
    const warpStrength = 80;
    const warpX = noise2D(x * 0.002, y * 0.002) * warpStrength;
    const warpY = noise2D((x + 1000) * 0.002, (y + 1000) * 0.002) * warpStrength;
    return { x: x + warpX, y: y + warpY };
}