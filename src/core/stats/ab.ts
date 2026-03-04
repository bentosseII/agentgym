import type { CompareMetricResult, ScoreDimensions } from '../types'
import { mean, stdDev } from '../utils/math'
import { hashString, SeededRandom } from '../utils/random'

const bootstrapCI = (values: number[], iterations = 1200): [number, number] => {
	if (values.length === 0) {
		return [0, 0]
	}
	const seed = hashString(values.join('|'))
	const rng = new SeededRandom(seed)
	const samples: number[] = []
	for (let i = 0; i < iterations; i += 1) {
		const draw: number[] = []
		for (let j = 0; j < values.length; j += 1) {
			draw.push(values[rng.int(0, values.length - 1)])
		}
		samples.push(mean(draw))
	}
	samples.sort((a, b) => a - b)
	const lower = samples[Math.floor(iterations * 0.025)]
	const upper = samples[Math.floor(iterations * 0.975)]
	return [Number(lower.toFixed(6)), Number(upper.toFixed(6))]
}

const permutationPValue = (values: number[], iterations = 2500): number => {
	if (values.length === 0) {
		return 1
	}
	const observed = Math.abs(mean(values))
	const rng = new SeededRandom(hashString(`perm:${values.join(',')}`))
	let extreme = 0
	for (let i = 0; i < iterations; i += 1) {
		const simulated = values.map((value) => (rng.next() < 0.5 ? value : -value))
		if (Math.abs(mean(simulated)) >= observed) {
			extreme += 1
		}
	}
	return Number(((extreme + 1) / (iterations + 1)).toFixed(6))
}

export const pairedMetricAnalysis = (
	metric: keyof Pick<
		ScoreDimensions,
		'quality' | 'taskSuccess' | 'costUsd' | 'timeSec' | 'reliability'
	>,
	valuesA: number[],
	valuesB: number[],
	options?: {
		lowerIsBetter?: boolean
	},
): CompareMetricResult => {
	if (valuesA.length !== valuesB.length) {
		throw new Error(`paired metric arrays length mismatch (${valuesA.length} != ${valuesB.length})`)
	}
	const direction = options?.lowerIsBetter ? -1 : 1
	const deltas = valuesB.map((valueB, index) => direction * (valueB - valuesA[index]))
	const meanDelta = mean(deltas)
	const ci95 = bootstrapCI(deltas)
	const pValue = permutationPValue(deltas)
	const sigma = stdDev(deltas)
	const effectSize = sigma === 0 ? 0 : meanDelta / sigma
	const probabilityImprovement =
		deltas.filter((delta) => delta > 0).length / Math.max(1, deltas.length)
	return {
		metric,
		meanDelta: Number(meanDelta.toFixed(6)),
		effectSize: Number(effectSize.toFixed(6)),
		pValue,
		ci95,
		probabilityImprovement: Number(probabilityImprovement.toFixed(6)),
		inconclusive: ci95[0] <= 0 && ci95[1] >= 0,
	}
}
