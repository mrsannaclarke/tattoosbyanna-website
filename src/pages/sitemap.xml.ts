export const prerender = true;

const pages = [
  '/',
  '/about/',
  '/contact/',
  '/portfolio/',
  '/booking-form/',
];

export function GET() {
  const urls = pages
    .map((path) => `  <url><loc>https://www.tattoosbyanna.com${path}</loc></url>`)
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
}
