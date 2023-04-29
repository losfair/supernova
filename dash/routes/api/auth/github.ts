import { HandlerContext, Handlers } from "$fresh/server.ts";
import * as cookie from "std/http/cookie.ts";
import { OAuthApp, Octokit } from "https://esm.sh/octokit@2.0.10";
import * as djwt from "djwt/mod.ts";
import { jwtSecretKey } from "../../../services/singleton.ts";

export interface Identity {
  exp: number;
  ghId: number;
  ghUsername: string;
  iss: "supernova-dash:github";
}

const ghApp = new OAuthApp({
  clientId: Deno.env.get("GITHUB_CLIENT_ID")!,
  clientSecret: Deno.env.get("GITHUB_CLIENT_SECRET")!,
});

const allowedGhUsers: number[] = [6104981];
const tokenTTLSecs = 86400 * 7;
const cookieTTLSecs = tokenTTLSecs - 3600;

export const handler: Handlers = {
  async GET(req: Request, _ctx: HandlerContext) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";

    if (!code || !state) {
      const state = crypto.randomUUID();
      const origin = url.origin.startsWith("http://localhost:") ? url.origin : `https://${url.hostname}`;
      const headers = new Headers({
        location: requestGithubLogin(
          `${origin}/api/auth/github`,
          state,
        ),
      });
      cookie.setCookie(headers, {
        name: "gh_login_state",
        value: state,
        expires: Date.now() + 600 * 1000,
        path: "/",
      });
      return new Response(null, {
        status: 302,
        headers,
      });
    }

    const cookies = cookie.getCookies(req.headers);

    const stateCookie = cookies.gh_login_state;
    if (!stateCookie || state !== stateCookie) {
      return Response.json({
        error: "invalid state",
      }, { status: 403 });
    }

    const result = await processGithubGrant(code);
    if (typeof result === "number") {
      return Response.json({
        error: "invalid code",
      }, { status: result });
    }

    const respHeaders = new Headers({
      location: "/dashboard",
    });

    cookie.setCookie(respHeaders, {
      name: "admin_token",
      value: result.jwt,
      expires: Date.now() + cookieTTLSecs * 1000,
      path: "/",
    });

    return new Response(null, {
      status: 302,
      headers: respHeaders,
    });
  },
};

export async function processGithubGrant(
  code: string,
): Promise<number | { jwt: string; identity: Identity }> {
  const tokenInfo = await ghApp.createToken({ code });
  const ghToken = tokenInfo.authentication.token;
  const octokit = new Octokit({
    auth: ghToken,
    userAgent: "Supernova-Dash",
  });
  const user = await octokit.rest.users.getAuthenticated();
  if (
    allowedGhUsers.length &&
    allowedGhUsers.findIndex((x) => x === user.data.id) == -1
  ) {
    console.log(`user not allowed: ${user.data.id} ${user.data.login}`);
    return 403;
  }
  const identity: Identity = {
    exp: Math.floor(Date.now() / 1000) + tokenTTLSecs,
    ghId: user.data.id,
    ghUsername: user.data.login,
    iss: "supernova-dash:github",
  };
  const jwt = await djwt.create(
    { alg: "HS256", typ: "JWT" },
    { ...identity },
    jwtSecretKey,
  );
  console.log(`user signed in: ${user.data.id} ${user.data.login}`);
  return {
    jwt,
    identity,
  };
}

export function requestGithubLogin(
  redirectUrl: string,
  state: string,
): string {
  const urlInfo = ghApp.getWebFlowAuthorizationUrl({
    scopes: ["user:email"],
    redirectUrl,
    state,
  });
  return urlInfo.url;
}
