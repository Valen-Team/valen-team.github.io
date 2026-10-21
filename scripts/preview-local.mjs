// Local-only production preview. The bridge uses the public proxy; no API key is stored.
import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {spawn} from 'node:child_process';
const root = resolve(import.meta.dirname, '../build');
const port = Number(process.env.VALEN_PREVIEW_PORT || 3030);
const endpoint = 'https://api.valen-team.workers.dev/v1/decisions';
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.ico': 'image/x-icon'};
function error(response, status, detail) {response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); response.end(JSON.stringify({detail}));}
const server = http.createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/api/decisions') {
      if (request.method !== 'POST') return error(response, 405, 'Use POST.');
      const origin = request.headers.origin;
      if (origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(origin)) return error(response, 403, 'Origin not allowed.');
      if (!request.headers['content-type']?.startsWith('application/json')) return error(response, 415, 'Send JSON.');
      let size = 0; const chunks = [];
      for await (const chunk of request) {size += chunk.length; if (size > 4500000) return error(response, 413, 'Request too large.'); chunks.push(chunk);}
      const child = spawn('curl', ['--silent', '--show-error', '--max-time', '115', '--max-filesize', '1048576', '--write-out', '\nHTTP_STATUS:%{http_code}', endpoint, '--header', 'Origin: https://valen-team.github.io', '--header', 'Content-Type: application/json', '--data-binary', '@-'], {stdio: ['pipe', 'pipe', 'pipe']});
      const output = []; let length = 0; let failed = false;
      child.stdout.on('data', chunk => {length += chunk.length; if (length > 1048576) {failed = true; child.kill();} else output.push(chunk);});
      // Suppress transport details; never log user inputs or model responses.
      child.stderr.resume(); child.stdin.on('error', () => {});
      response.on('close', () => {if (!response.writableEnded) child.kill();});
      child.on('error', () => {if (!response.writableEnded) error(response, 502, 'Local preview bridge unavailable.');});
      child.on('close', code => {
        if (response.writableEnded) return;
        const text = Buffer.concat(output).toString(); const match = /\nHTTP_STATUS:(\d{3})$/.exec(text);
        if (failed || code !== 0 || !match || Number(match[1]) < 100) return error(response, 502, 'Could not reach the model service.');
        response.writeHead(Number(match[1]), {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); response.end(text.slice(0, match.index));
      });
      child.stdin.end(Buffer.concat(chunks)); return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) return error(response, 405, 'Use GET.');
    let file = resolve(root, `.${decodeURIComponent(path)}`);
    if (file !== root && !file.startsWith(root + sep)) return error(response, 403, 'Forbidden.');
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {file = resolve(file, 'index.html'); info = await stat(file).catch(() => null);}
    if (!info?.isFile()) {file = resolve(root, '404.html'); info = await stat(file); response.statusCode = 404;}
    const headers = {'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes'};
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
    if (range && response.statusCode !== 404) {
      const start = Number(range[1]); const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) {response.writeHead(416, {'Content-Range': `bytes */${info.size}`}); return response.end();}
      response.writeHead(206, {...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1});
      if (request.method === 'HEAD') return response.end();
      createReadStream(file, {start, end}).pipe(response); return;
    }
    response.writeHead(response.statusCode, {...headers, 'Content-Length': info.size});
    if (request.method === 'HEAD') return response.end();
    createReadStream(file).pipe(response);
  } catch {if (!response.headersSent) error(response, 500, 'Preview request failed.'); else response.destroy();}
});
server.listen(port, '127.0.0.1', () => console.log(`Ask Valen preview: http://127.0.0.1:${port}/`));
