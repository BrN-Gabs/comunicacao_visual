import axios from "axios";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const internalApiUrl =
  process.env.INTERNAL_API_URL?.replace(/\/+$/, "").replace(/\/api$/, "") ??
  "http://localhost:3000";

function buildTargetUrl(request: NextRequest, path: string[]) {
  const joinedPath = path.map(encodeURIComponent).join("/");
  const search = request.nextUrl.search || "";
  return `${internalApiUrl}/api/exports/${joinedPath}${search}`;
}

type RouteContext = { params: Promise<{ path: string[] }> };
type ProxyMethod = "GET" | "POST";

function buildForwardHeaders(request: NextRequest, includeBodyHeaders = false) {
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (accept) {
    headers.set("accept", accept);
  }

  if (includeBodyHeaders && contentType) {
    headers.set("content-type", contentType);
  }

  return headers;
}

function copyResponseHeaders(source: Headers) {
  const headers = new Headers();

  source.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") {
      return;
    }

    headers.set(key, value);
  });

  return headers;
}

function buildAxiosResponseHeaders(
  source: Record<
    string,
    string | string[] | number | boolean | null | undefined
  >,
) {
  const headerEntries: Array<[string, string]> = [];

  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((headerValue) => {
        headerEntries.push([key, headerValue]);
      });
      return;
    }

    if (value !== undefined && value !== null) {
      headerEntries.push([key, String(value)]);
    }
  });

  return new Headers(headerEntries);
}

async function proxyExportsRequest(
  request: NextRequest,
  context: RouteContext,
  method: ProxyMethod,
) {
  const { path } = await context.params;
  const targetUrl = buildTargetUrl(request, path);
  const requestBody =
    method === "GET" || request.body === null
      ? undefined
      : Buffer.from(await request.arrayBuffer());
  const upstreamResponse = await axios.request<Readable>({
    url: targetUrl,
    method,
    headers: Object.fromEntries(
      buildForwardHeaders(request, method !== "GET").entries(),
    ),
    data: requestBody,
    responseType: "stream",
    timeout: 0,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true,
  });

  return new Response(Readable.toWeb(upstreamResponse.data) as BodyInit, {
    status: upstreamResponse.status,
    headers: copyResponseHeaders(
      buildAxiosResponseHeaders(
        upstreamResponse.headers as Record<
          string,
          string | string[] | number | boolean | null | undefined
        >,
      ),
    ),
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyExportsRequest(request, context, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyExportsRequest(request, context, "POST");
}
