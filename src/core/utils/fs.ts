import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const ensureDir = async (dir: string): Promise<void> => {
	await mkdir(dir, { recursive: true })
}

export const writeJson = async (filePath: string, value: unknown): Promise<void> => {
	await ensureDir(path.dirname(filePath))
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

export const readJson = async <T>(filePath: string): Promise<T> => {
	const raw = await readFile(filePath, 'utf-8')
	return JSON.parse(raw) as T
}

export const fileExists = async (target: string): Promise<boolean> => {
	try {
		await stat(target)
		return true
	} catch {
		return false
	}
}

export const listRunDirs = async (baseRunsDir: string): Promise<string[]> => {
	if (!(await fileExists(baseRunsDir))) {
		return []
	}
	const entries = await readdir(baseRunsDir, { withFileTypes: true })
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((a, b) => b.localeCompare(a))
}
