// 로컬 연습용 서버: npm run dev → http://localhost:3000
// Vercel이 하는 일(정적 파일 제공 + /api/* 를 api/ 폴더의 함수로 연결)을 흉내 낸다.
// SUPABASE_URL이 없으면 메모리 DB를 쓴다(서버를 끄면 자료가 사라짐).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 3000;
if (!process.env.SUPABASE_URL) process.env.DB_DRIVER = 'memory';
if (!process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = 'local-admin-only';
  console.log('[로컬] ADMIN_PASSWORD가 없어 진행자 비밀번호를 local-admin-only 로 씁니다(로컬 전용).');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const BLOCKED = /^\/(api\/_lib|scripts|tests|sql|node_modules|\.)/; // 배포에서도 공개되지 않는 경로

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/_')) {
      const file = path.join(root, `${url.pathname.replace(/\/$/, '')}.js`);
      await stat(file);
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }
    if (BLOCKED.test(url.pathname)) throw new Error('blocked');
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) throw new Error('blocked');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(port, () => console.log(`[로컬] http://localhost:${port}  (진행자 화면: /admin.html, DB: ${process.env.DB_DRIVER || 'supabase'})`));
export default server;
