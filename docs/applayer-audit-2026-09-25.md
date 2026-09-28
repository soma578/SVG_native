# AppLayer compatibility audit — 2026-09-28

## Scope

- Target: local Next.js host with Chromium
- Container layers: 174
- Level: 1 (bootstrap), 10-second per-layer ceiling
- Isolation: a fresh SVGMap document for every layer
- Service Worker: disabled in Playwright so HTTP behavior is measured directly

The generated detailed report is written to
`artifacts/applayer-audit/all-local-level1.json` and intentionally ignored by
Git. The counts below apply the corrected classifier: a 404 forwarded by the
proxy is an upstream response, not a missing local asset, and the optional
authoring `index.txt` probe is ignored because its 404 selects IndexedDB mode.

After targeted reruns of every former failure category, the reconciled local
result is:

| Category | Count |
| --- | ---: |
| PASS | 165 |
| EXTERNAL_API_CHANGED | 6 |
| SPECIAL_BACKEND_REQUIRED | 1 |
| CONFIG_REQUIRED | 1 |
| USER_CREDENTIAL_REQUIRED | 1 |

`PROXY_POLICY_MISS` is a review queue, not an instruction to allow every host.
It includes community and user-facing services as well as public agencies.
Each candidate still needs a read-only host/protocol/path rule and a response
size ceiling before it can enter the anonymous relay.

## Confirmed original failures

- `地理院 指定避難所`: PASS
- `地理院 指定緊急避難場所`: PASS
- `気象庁_2021_アメダス`: PASS
- `警察庁_交通事故データ`: PASS at Level 1
- `警察庁_交通事故データ`: PASS at Level 3 after selecting 2024; both the
  XLSX codebook and the approximately 62 MB CSV returned 200 through
  `/api/cors-proxy`.

## Repairs verified in Chromium

- All 35 former `PROXY_POLICY_MISS` layers now pass with reviewed
  host/protocol/path policies. This includes the NII blank-tile redirect,
  ODPT worker, MHLW, Soramame, JTWC, MLIT, and the other known public sources.
- GSI pages served by `www.gsi.go.jp` require legacy TLS renegotiation. The
  proxy uses the compatibility TLS option only for that exact official host;
  both affected GSI layers now pass.
- Optional missing GSI/JMA vector tiles no longer throw JavaScript exceptions.
  JMA's archived 2021 layer no longer requests a post-2021 overlay.
- JTWC KMZ archives are downloaded through the allowlisted proxy and unzipped
  from an in-memory buffer. River tile existence checks now use the proxy.
- Fixed-target Next.js backends replace the PHP/worker assumptions for K-NET,
  the JMA earthquake database, and eMAFF. K-NET and JMA pass Level 1; eMAFF
  passes Level 3 after the audit zooms into Tokyo and receives four successful
  backend responses.

## Remaining non-pass categories

- Six marine-information (`海しる`) layers use a retired token API. The old
  endpoint now redirects to the portal and the former ArcGIS service returns
  403. They are classified `EXTERNAL_API_CHANGED`, and `/api/msil-token`
  returns an explicit 410 rather than disguising the condition as a proxy
  failure.
- Yahoo Geocoder remains `SPECIAL_BACKEND_REQUIRED` because a Yahoo Client ID
  must be supplied by the operator.
- GraphHopper requires an endpoint, and Gemini requires user credentials.
- Run the same audit against a Vercel Preview with
  `APPLAYER_AUDIT_BASE_URL`. Preview results are required before treating this
  local table as the deployment compatibility matrix.

## Core defect found by the audit

`SVGMapLv0.1_Class_r18module.js` could give `insertBefore()` a node that was a
nested descendant or had already been detached by a concurrent render. That
caused an intermittent `NotFoundError` while enabling the NPA layer. The local
core now checks parentage and chooses only a direct-child insertion reference.
