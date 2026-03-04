export class SeededRandom {
	private state: number

	constructor(seed: number) {
		this.state = seed >>> 0
	}

	next(): number {
		this.state = (1664525 * this.state + 1013904223) >>> 0
		return this.state / 0x100000000
	}

	int(min: number, max: number): number {
		if (max < min) {
			throw new Error(`invalid bounds ${min}..${max}`)
		}
		return Math.floor(this.next() * (max - min + 1)) + min
	}

	pick<T>(items: readonly T[]): T {
		if (items.length === 0) {
			throw new Error('cannot pick from empty array')
		}
		return items[this.int(0, items.length - 1)]
	}
}

export const hashString = (value: string): number => {
	let hash = 2166136261
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}
