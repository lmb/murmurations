import esbuild from 'esbuild'

await esbuild.build({
	entryPoints: ['murmuration.ts', 'index.html'],
	outdir: 'public',
	minify: true,
	bundle: true,
	sourcemap: false,
	format: 'esm',
	loader: { '.html': 'copy' },
})

console.log('Build complete')
