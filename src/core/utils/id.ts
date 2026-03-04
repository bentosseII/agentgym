export const makeRunId = (prefix = 'run'): string => {
	const stamp = new Date()
		.toISOString()
		.replace(/[-:.TZ]/g, '')
		.slice(0, 14)
	const random = Math.random().toString(36).slice(2, 8)
	return `${prefix}-${stamp}-${random}`
}
