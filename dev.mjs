import esbuild from 'esbuild';
import http from 'node:http';

let ctx = await esbuild.context({
	entryPoints: ['murmuration.ts', 'murmuration.html'],
	outdir: 'public',
	bundle: true,
	sourcemap: true,
	format: 'esm',
	loader: { '.html': 'copy' },
});

await ctx.watch()

let { host, port } = await ctx.serve({
	host: 'localhost',
	servedir: 'public',
});

http.createServer((req, res) => {
	const options = {
		hostname: host,
		port: port,
		path: req.url,
		method: req.method,
		headers: req.headers,
	}

	// Forward each incoming request to esbuild
	const proxyReq = http.request(options, proxyRes => {
		// Add COOP/COEP headers for SharedArrayBuffer support
		const headers = {
			...proxyRes.headers,
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin"
		};
		// Forward the response from esbuild to the client with added headers
		res.writeHead(proxyRes.statusCode, headers);
		proxyRes.pipe(res, { end: true });
	})

	// Forward the body of the request to esbuild
	req.pipe(proxyReq, { end: true })
}).listen(3000, "localhost");

console.log(`Server running at http://localhost:3000`);
