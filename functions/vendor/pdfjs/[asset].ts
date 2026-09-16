const PDFJS_VERSION = "4.10.38";

const ALLOWED_ASSETS: Record<string, string> = {
  "pdf.mjs": `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`,
  "pdf.worker.mjs": `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`,
};

type PagesContext = {
  params: Record<string, string | string[]>;
};

export const onRequest = async ({ params }: PagesContext): Promise<Response> => {
  const rawAsset = params.asset;
  const asset = Array.isArray(rawAsset) ? rawAsset[0] : rawAsset;
  const upstreamUrl = asset ? ALLOWED_ASSETS[asset] : undefined;

  if (!upstreamUrl) {
    return new Response("Not found", {
      status: 404,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "text/javascript, application/javascript;q=0.9, */*;q=0.1" },
    });

    if (!upstream.ok || !upstream.body) {
      return new Response("PDF engine unavailable", {
        status: 502,
        headers: { "X-Content-Type-Options": "nosniff" },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
        "X-PDFJS-Version": PDFJS_VERSION,
      },
    });
  } catch {
    return new Response("PDF engine unavailable", {
      status: 502,
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  }
};
