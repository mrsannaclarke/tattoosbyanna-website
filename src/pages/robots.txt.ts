export const prerender = true;

export function GET() {
  return new Response(
    'User-agent: *\nAllow: /\nSitemap: https://www.tattoosbyanna.com/sitemap.xml\n',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}
