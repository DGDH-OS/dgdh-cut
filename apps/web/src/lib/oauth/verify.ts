/**
 * DGDH OAuth-validatie voor apps (kopieerbare module, ZONDER imports uit de rest van de repo).
 * Draait op Node 20+, Cloudflare Workers en Next (alleen WebCrypto + fetch).
 *
 * Gebruik in een app (naast de bestaande Bearer-API-key):
 *
 *   const auth = await verifyBearer(request, {
 *     resource: "https://studio.dgdh-os.com/api/mcp",   // canonieke MCP-URL van DEZE app (= aud)
 *     app: "cut",                                         // slug van deze app
 *   });
 *   if (auth.kind === "oauth") {
 *     // auth.ok: { org, scopes, grantId, clientId, sub }  -> bouw hiermee je bestaande key-record
 *     // fout:    return auth.response  (401/403 met WWW-Authenticate resource_metadata)
 *   }
 *   // auth.kind === "none": geen OAuth-token (bv. suite_live_/cut_live_ key): val terug op je eigen key-check.
 *
 * Tenant (org) komt UIT HET TOKEN, nooit uit het verzoek. Intrekking: standaard controleert de lib het
 * Suite-endpoint /oauth/introspect (cache 30 s, fail closed bij een storing); zet `introspect: false`
 * alleen als je de grant zelf in de database controleert (zoals de Suite).
 * Documentatie: docs/OAUTH.md
 */

export const DEFAULT_ISSUER = "https://id.dgdh-os.com";

export type OAuthClaims = {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  scope: string;
  client_id: string;
  org: string;
  app: string;
  grant: string;
};
export type OAuthIdentity = {
  org: string;
  app: string;
  scopes: string[];
  grantId: string;
  clientId: string;
  sub: string;
  exp: number;
};
export type VerifyOptions = {
  /** Canonieke MCP-URL van deze app, zonder trailing slash. Token moet hier exact voor zijn uitgegeven. */
  resource: string;
  /** App-slug; het token moet voor deze app zijn. */
  app: string;
  issuer?: string;
  /** JWKS (lokaal, bv. in de Suite zelf) of via jwksUrl ophalen. */
  jwks?: { keys: JsonWebKey[] };
  jwksUrl?: string;
  /** Intrekking via /oauth/introspect controleren (standaard aan). */
  introspect?: boolean;
  /** Benodigde scope voor dit verzoek (voor 403 insufficient_scope). */
  requiredScope?: string;
  fetchImpl?: typeof fetch;
  now?: () => number; // ms
};
export type VerifyResult =
  | { ok: true; identity: OAuthIdentity }
  | { ok: false; status: 401 | 403 | 503; error: string; description: string };

const b64u = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const text = (s: string) => new TextDecoder().decode(b64u(s));

/** Een JWT herkenbaar als OAuth-token (drie delen, begint met eyJ). Keys (xxx_live_...) zijn dat niet. */
export const looksLikeJwt = (token: string) => /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(token);

export function bearerOf(request: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

const jwksCache = new Map<string, { at: number; keys: JsonWebKey[] }>();
async function loadJwks(o: VerifyOptions, forceFresh = false): Promise<JsonWebKey[]> {
  if (o.jwks) return o.jwks.keys;
  const url = o.jwksUrl ?? `${o.issuer ?? DEFAULT_ISSUER}/.well-known/jwks.json`;
  const now = (o.now ?? Date.now)();
  const hit = jwksCache.get(url);
  if (hit && !forceFresh && now - hit.at < 10 * 60_000) return hit.keys;
  const res = await (o.fetchImpl ?? fetch)(url, {
    headers: { accept: "application/json", "user-agent": "dgdh-oauth-verify/1" },
  });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const keys = ((await res.json()) as { keys: JsonWebKey[] }).keys;
  jwksCache.set(url, { at: now, keys });
  return keys;
}

const fail = (
  status: 401 | 403 | 503,
  error: string,
  description: string,
): { ok: false; status: 401 | 403 | 503; error: string; description: string } => ({
  ok: false,
  status,
  error,
  description,
});

const introCache = new Map<string, { at: number; active: boolean }>();

export async function verifyAccessToken(token: string, o: VerifyOptions): Promise<VerifyResult> {
  const issuer = o.issuer ?? DEFAULT_ISSUER;
  const nowMs = (o.now ?? Date.now)();
  const parts = token.split(".");
  if (parts.length !== 3) return fail(401, "invalid_token", "geen geldig token");
  let header: { alg?: string; kid?: string; typ?: string };
  let claims: OAuthClaims;
  try {
    header = JSON.parse(text(parts[0]));
    claims = JSON.parse(text(parts[1]));
  } catch {
    return fail(401, "invalid_token", "geen geldig token");
  }
  if (header.alg !== "ES256") return fail(401, "invalid_token", "algoritme niet toegestaan");
  let keys: JsonWebKey[];
  try {
    keys = await loadJwks(o);
  } catch {
    return fail(503, "temporarily_unavailable", "sleutels niet bereikbaar");
  }
  let jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk && !o.jwks) {
    try {
      jwk = (await loadJwks(o, true)).find((k) => (k as { kid?: string }).kid === header.kid);
    } catch {
      return fail(503, "temporarily_unavailable", "sleutels niet bereikbaar");
    }
  }
  if (!jwk) return fail(401, "invalid_token", "onbekende sleutel");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    b64u(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) return fail(401, "invalid_token", "handtekening ongeldig");
  if (claims.iss !== issuer) return fail(401, "invalid_token", "verkeerde uitgever");
  // Audience binding: alleen tokens die voor DEZE resource zijn uitgegeven (geen token-passthrough).
  if (claims.aud !== o.resource.replace(/\/+$/, ""))
    return fail(401, "invalid_token", "token is niet voor deze app uitgegeven");
  if (claims.app !== o.app) return fail(401, "invalid_token", "token is niet voor deze app");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= nowMs)
    return fail(401, "invalid_token", "token verlopen");
  if (!claims.org || !claims.grant || !claims.sub)
    return fail(401, "invalid_token", "onvolledig token");
  const scopes = (claims.scope ?? "").split(" ").filter(Boolean);
  if (o.introspect !== false) {
    const hit = introCache.get(claims.grant);
    let active: boolean;
    if (hit && nowMs - hit.at < 30_000) active = hit.active;
    else {
      try {
        const res = await (o.fetchImpl ?? fetch)(`${issuer}/oauth/introspect`, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": "dgdh-oauth-verify/1",
          },
          body: new URLSearchParams({ token }).toString(),
        });
        if (!res.ok)
          return fail(503, "temporarily_unavailable", "intrekkingscontrole niet bereikbaar");
        active = ((await res.json()) as { active?: boolean }).active === true;
      } catch {
        return fail(503, "temporarily_unavailable", "intrekkingscontrole niet bereikbaar");
      }
      introCache.set(claims.grant, { at: nowMs, active });
    }
    if (!active) return fail(401, "invalid_token", "verbinding ingetrokken");
  }
  if (o.requiredScope && !scopes.includes(o.requiredScope))
    return fail(403, "insufficient_scope", `scope ${o.requiredScope} ontbreekt`);
  return {
    ok: true,
    identity: {
      org: claims.org,
      app: claims.app,
      scopes,
      grantId: claims.grant,
      clientId: claims.client_id,
      sub: claims.sub,
      exp: claims.exp,
    },
  };
}

export const prmUrl = (resource: string) => {
  const u = new URL(resource);
  return `${u.origin}/.well-known/oauth-protected-resource${u.pathname.replace(/\/+$/, "")}`;
};

/** 401/403 met WWW-Authenticate die naar de Protected Resource Metadata wijst (RFC 9728). */
export function challenge(
  resource: string,
  status: 401 | 403 | 503,
  error?: string,
  description?: string,
  scope?: string,
): Response {
  const bits = ['Bearer realm="dgdh"', `resource_metadata="${prmUrl(resource)}"`];
  if (error && status !== 503) bits.push(`error="${error}"`);
  if (description) bits.push(`error_description="${description.replace(/"/g, "'")}"`);
  if (scope) bits.push(`scope="${scope}"`);
  return Response.json(
    { ok: false, error: description ?? error ?? "unauthorized" },
    { status, headers: { "www-authenticate": bits.join(", "), "cache-control": "no-store" } },
  );
}

/** Protected Resource Metadata-document (RFC 9728) voor een app. */
export function protectedResourceMetadata(
  resource: string,
  scopes: string[],
  issuer = DEFAULT_ISSUER,
) {
  return {
    resource: resource.replace(/\/+$/, ""),
    authorization_servers: [issuer],
    scopes_supported: scopes,
    bearer_methods_supported: ["header"],
    resource_name: "DGDH OS",
  };
}

export type BearerResult =
  | { kind: "none" } // geen OAuth-token aangeboden: gebruik de eigen API-key-validatie
  | { kind: "oauth"; ok: true; identity: OAuthIdentity }
  | { kind: "oauth"; ok: false; response: Response };

/** Eerste stap in elke agent-route. Alleen JWT's worden hier afgehandeld; API-keys blijven bij de app. */
export async function verifyBearer(request: Request, o: VerifyOptions): Promise<BearerResult> {
  const token = bearerOf(request);
  if (!token || !looksLikeJwt(token)) return { kind: "none" };
  const r = await verifyAccessToken(token, o);
  if (r.ok) return { kind: "oauth", ok: true, identity: r.identity };
  return {
    kind: "oauth",
    ok: false,
    response: challenge(o.resource, r.status, r.error, r.description, o.requiredScope),
  };
}
