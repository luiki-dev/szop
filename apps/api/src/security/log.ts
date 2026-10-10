import type { FastifyRequest } from "fastify";

// Hides every query value and keeps the names, so a token never reaches the
// log, whatever its parameter is called. Tokens travel in the query string,
// never in the path (ADR 0012, decision 9; ADR 0025, decision 6). A parameter
// without "=" is hidden whole: the bare value could be a token.
export function redactUrl(url: string): string {
  const start = url.indexOf("?");
  if (start === -1) return url;
  const query = url
    .slice(start + 1)
    .split("&")
    .map((parameter) => {
      if (parameter === "") return parameter;
      const equals = parameter.indexOf("=");
      return equals === -1
        ? "[redacted]"
        : `${parameter.slice(0, equals)}=[redacted]`;
    })
    .join("&");
  return `${url.slice(0, start)}?${query}`;
}

// Fastify's default request serializer with the URL redacted, used by every
// log line that carries the request ("incoming request", errors). It leaves
// out `version`, the Accept-Version header, which Szop does not use.
export function requestSerializer(request: FastifyRequest): {
  method: string;
  url: string;
  host: string;
  remoteAddress: string;
  remotePort: number | undefined;
} {
  return {
    method: request.method,
    url: redactUrl(request.url),
    host: request.host,
    // The address behind the trusted proxies (ADR 0025, decision 7).
    remoteAddress: request.ip,
    remotePort: request.socket.remotePort,
  };
}
