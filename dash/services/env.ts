export const dashEnv = {
  AWS_ACCESS_KEY_ID: Deno.env.get("AWS_ACCESS_KEY_ID") ?? "",
  AWS_SECRET_ACCESS_KEY: Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "",
};
