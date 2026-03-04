export const mean = (values: number[]): number => {
	if (values.length === 0) {
		return 0
	}
	return values.reduce((sum, value) => sum + value, 0) / values.length
}

export const median = (values: number[]): number => {
	if (values.length === 0) {
		return 0
	}
	const sorted = [...values].sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)
	if (sorted.length % 2 === 0) {
		return (sorted[middle - 1] + sorted[middle]) / 2
	}
	return sorted[middle]
}

export const stdDev = (values: number[]): number => {
	if (values.length <= 1) {
		return 0
	}
	const avg = mean(values)
	const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
	return Math.sqrt(variance)
}

export const clamp = (value: number, min: number, max: number): number => {
	return Math.min(max, Math.max(min, value))
}
