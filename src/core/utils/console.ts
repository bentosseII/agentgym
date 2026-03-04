export const logInfo = (message: string): void => {
	process.stdout.write(`${message}\n`)
}

export const logError = (message: string): void => {
	process.stderr.write(`${message}\n`)
}

export const asPercent = (value: number, decimals = 1): string =>
	`${(value * 100).toFixed(decimals)}%`

export const asCurrency = (value: number): string => `$${value.toFixed(4)}`

export const asSeconds = (value: number): string => `${value.toFixed(2)}s`

export const asScore = (value: number): string => value.toFixed(2)
