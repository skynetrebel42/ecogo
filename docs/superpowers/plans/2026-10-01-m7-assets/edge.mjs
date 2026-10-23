// 073: every gate's headless Edge. A fresh profile per run (a reused one keeps old localStorage, so "first visit" wouldn't
// be one). close() asks Edge to quit (Browser.close over CDP), then stops whatever still runs on that profile: on Windows
// Edge's browser process outlives edge.kill(), and after many runs a gate could attach to an old browser on its port.
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
// Waits up to 5 s for the profile's processes to exit, stops any left, prints "<stopped> <still running>".
const SWEEP = `$f = { @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | ? { $_.CommandLine -and $_.CommandLine.Contains($env:ECOGO_PROFILE) }) }
for ($i = 0; $i -lt 20 -and (& $f).Count; $i++) { Start-Sleep -Milliseconds 250 }
$left = @(& $f); $left | % { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; if ($left.Count) { Start-Sleep 1 }
"$($left.Count) $((& $f).Count)"`;

// name: the profile's name (ecogo-<name>-<port>); base: the first of 90 ports; size: "w,h"; ms: the gate's time budget.
export function startEdge(name, base, size, ms) {
  const PORT = base + Math.floor(Math.random() * 90);
  const PROFILE = `${process.env.TEMP}\\ecogo-${name}-${PORT}`;
  rmSync(PROFILE, { recursive: true, force: true });
  spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--window-size=${size}`,
    `--user-data-dir=${PROFILE}`, "about:blank"], { stdio: "ignore" });
  let closing; // one close, whether the gate's finally or its timeout asks first
  const close = () => closing ??= (async () => {
    const quit = (async () => {
      const ws = new WebSocket((await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl);
      await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
      ws.send(JSON.stringify({ id: 1, method: "Browser.close" }));
      await new Promise(r => { ws.onclose = r; });
    })().catch(() => {}); // Edge already gone or not answering: the sweep handles it
    await Promise.race([quit, new Promise(r => setTimeout(r, 5000))]);
    try {
      const [stopped, left] = execFileSync("powershell.exe", ["-NoProfile", "-Command", SWEEP],
        { env: { ...process.env, ECOGO_PROFILE: PROFILE }, timeout: 30000 }).toString().trim().split(" ").map(Number);
      return { stopped, left };
    } catch (err) { return { left: NaN, error: String(err).slice(0, 200) }; }
  })();
  setTimeout(async () => { console.log("TIMEOUT"); await close(); process.exit(1); }, ms).unref();
  // A gate's last check: its browser closed, and nothing runs on its profile any more.
  const closeAndCheck = async check => {
    const { stopped, left, error } = await close();
    check("073: Edge closed; nothing left running on its profile", left === 0, error ?? (stopped ? `${stopped} stopped after Browser.close` : ""));
  };
  return { PORT, closeAndCheck };
}
