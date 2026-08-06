export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Miljøvariabelen ${name} mangler`)
  return value
}

const allowedOrigins = requiredEnv('APP_ORIGIN')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

export function assertAllowedOrigin(request: Request) {
  const origin = request.headers.get('origin')?.replace(/\/+$/, '')
  if (origin && !allowedOrigins.includes(origin)) {
    throw new HttpError(403, 'Forespørselen kommer fra et ukjent nettsted')
  }
}

export function corsHeaders(request: Request) {
  const requestOrigin = request.headers.get('origin')?.replace(/\/+$/, '')
  const responseOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) throw new HttpError(401, 'Innlogging kreves')
  return { authorization, token: match[1] }
}

export function jsonResponse(request: Request, body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders(request),
  })
}

export function errorResponse(request: Request, error: unknown) {
  console.error(error)
  if (error instanceof HttpError) {
    return jsonResponse(request, { error: error.message }, error.status)
  }
  return jsonResponse(request, { error: 'En intern feil oppstod' }, 500)
}
