/**
 * Ping /health and fail non-zero when API or DB is down.
 * Usage:
 *   npx ts-node scripts/health-check.ts
 *   npx ts-node scripts/health-check.ts https://your-api.vercel.app
 *
 * Wire this into a cron / UptimeRobot / GitHub Action to catch Supabase pause.
 */
import "dotenv/config";

const base = (process.argv[2] ?? `http://localhost:${process.env.PORT ?? 3001}`).replace(/\/$/, "");

type HealthBody = {
  ok?: boolean;
  db?: boolean;
  timezone?: string;
  time?: string;
  config?: Record<string, unknown>;
};

async function main() {
  const url = `${base}/health`;
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error(
      JSON.stringify({
        ok: false,
        url,
        error: err instanceof Error ? err.message : String(err),
        hint: "API unreachable — Vercel down, wrong URL, or network issue",
      })
    );
    process.exit(1);
  }

  const ms = Date.now() - started;
  let body: HealthBody = {};
  try {
    body = (await res.json()) as HealthBody;
  } catch {
    body = {};
  }

  const ok = res.ok && body.ok === true && body.db === true;
  console.log(JSON.stringify({ ok, status: res.status, ms, url, body }, null, 2));

  if (!ok) {
    if (body.db === false) {
      console.error("HINT: DB probe failed — Supabase may be paused or DATABASE_URL is wrong");
    }
    process.exit(1);
  }
}

main();
