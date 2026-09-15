// Log only narrow diagnostic fields. Never pass a Google error object, request,
// credentials, or response body directly to console.*.
export function safeGoogleFailure(error, credentialsJson, credentials) {
  const httpStatus = error?.response?.status
  const googleStatus = error?.response?.data?.error?.status
  const googleMessage = error?.response?.data?.error?.message
  return {
    httpStatus: Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599
      ? httpStatus : null,
    googleStatus: typeof googleStatus === 'string' && /^[A-Z_]{1,50}$/.test(googleStatus)
      ? googleStatus : null,
    googleMessage: typeof googleMessage === 'string'
      ? redactGoogleMessage(googleMessage, credentialsJson, credentials)
      : null,
  }
}

function redactGoogleMessage(message, credentialsJson, credentials) {
  let safe = message
  for (const secret of [credentialsJson, credentials?.private_key, credentials?.client_email]) {
    if (typeof secret === 'string' && secret) {
      for (const variant of [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret)]) {
        safe = safe.replaceAll(variant, '[redacted]')
      }
    }
  }
  return safe
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, '[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/\bya29\.[A-Za-z0-9._~+\/-]+/g, '[redacted]')
    .replace(/\b(?:access_token|refresh_token|private_key|client_secret)\s*[=:]\s*[^\s&,]+/gi, '[redacted]')
    .replace(/[\r\n\t\x00-\x1f\x7f]+/g, ' ')
    .slice(0, 500)
}

export function safeNormalizationFailure(error) {
  const message = error?.message
  return typeof message === 'string' && (
    message === 'Sheet values are not rows'
    || /^Invalid row \d+$/.test(message)
    || /^Missing title or invalid coordinates at row \d+$/.test(message)
  ) ? message : 'Unexpected CSV normalization error'
}
