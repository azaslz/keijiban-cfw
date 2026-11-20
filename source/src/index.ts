const NAME_MAX = 50;
const BODY_MAX = 1000;
const LIST_LIMIT = 200;
const DEFAULT_NAME = '名無し';

type Post = { id: number; name: string; body: string; created_at: string };

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

async function listPosts(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, name, body, created_at FROM posts
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
  ).bind(LIST_LIMIT).all<Post>();
  return json({ posts: results });
}

async function createPost(request: Request, env: Env): Promise<Response> {
  // ブラウザから別オリジンのフォーム等で投稿させない。
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'Content-Type は application/json にしてください。' }, 415);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'リクエストの形式が正しくありません。' }, 400);
  }
  const { name: rawName, body: rawBody } = (input ?? {}) as { name?: unknown; body?: unknown };
  if ((rawName !== undefined && rawName !== null && typeof rawName !== 'string') || typeof rawBody !== 'string') {
    return json({ error: '名前と本文は文字列で送信してください。' }, 400);
  }

  const name = (rawName ?? '').trim() || DEFAULT_NAME;
  const body = rawBody.trim();
  if (!body) return json({ error: '本文を入力してください。' }, 400);
  if (name.length > NAME_MAX) return json({ error: `名前は${NAME_MAX}文字以内で入力してください。` }, 400);
  if (body.length > BODY_MAX) return json({ error: `本文は${BODY_MAX}文字以内で入力してください。` }, 400);

  const post = await env.DB.prepare(
    `INSERT INTO posts (name, body) VALUES (?, ?)
     RETURNING id, name, body, created_at`,
  ).bind(name, body).first<Post>();
  if (!post) throw new Error('Post insert returned no row');
  return json({ post }, 201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/health') {
      if (request.method !== 'GET') {
        return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
      }
      try {
        await env.DB.prepare('SELECT 1').first();
        return json({ status: 'ok' });
      } catch (error) {
        console.error('Health check database error:', error);
        return json({ status: 'error' }, 503);
      }
    }
    if (pathname !== '/api/posts') {
      return json({ error: 'not_found' }, 404);
    }
    try {
      if (request.method === 'GET') return await listPosts(env);
      if (request.method === 'POST') return await createPost(request, env);
      return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
    } catch (error) {
      console.error('Posts database error:', error);
      return json({ error: '投稿を取得・保存できませんでした。もう一度お試しください。' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
