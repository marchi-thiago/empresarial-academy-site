/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "@payloadcms/next/withPayload" {
  import type { NextConfig } from "next";

  export function withPayload(config: NextConfig): NextConfig;
}

declare module "@payloadcms/next/routes" {
  type PayloadConfig = unknown;
  type RouteHandler = (request: Request, args?: unknown) => Promise<Response> | Response;

  export function REST_GET(config: PayloadConfig): RouteHandler;
  export function REST_POST(config: PayloadConfig): RouteHandler;
  export function REST_PATCH(config: PayloadConfig): RouteHandler;
  export function REST_PUT(config: PayloadConfig): RouteHandler;
  export function REST_DELETE(config: PayloadConfig): RouteHandler;
  export function REST_OPTIONS(config: PayloadConfig): RouteHandler;
  export function GRAPHQL_POST(config: PayloadConfig): RouteHandler;
  export function GRAPHQL_PLAYGROUND_GET(config: PayloadConfig): RouteHandler;
}

declare module "@payloadcms/next/views" {
  export function generatePageMetadata(...args: unknown[]): unknown;
  export function RootPage(...args: unknown[]): unknown;
  export function NotFoundPage(...args: unknown[]): unknown;
}

declare module "@payloadcms/next/layouts" {
  export function RootLayout(...args: unknown[]): unknown;
  export function handleServerFunctions(...args: unknown[]): unknown;
}
