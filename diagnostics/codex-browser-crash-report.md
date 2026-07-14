# Codex desktop browser-automation crash diagnostic

Scan time: 2026-07-13 22:02–22:16 EDT (America/Toronto)  
Scope: read-only Windows process, profile, port, version, resource, Event Viewer, AppX, WER, and sanitized application-log review.  
Corrective action taken: none. No browser was launched, no process was stopped, no profile/cache was cleared, and no setting or installation was changed.

## Executive diagnosis

The strongest explanation is a **Codex/ChatGPT browser-integration resource leak or lifecycle regression**, made more likely by today's rapid Codex updates and triggered at the boundary where browser automation is invoked. The most recent failure is timestamp-correlated to a `node_repl` browser call, not merely to Chrome being open:

1. At **20:46:45**, the Codex backend (PID 9704 for that session) began an `mcp__node_repljs` call using the browser automation bridge.
2. The backend log ends abruptly at 20:46:45 without a handled exception or orderly shutdown.
3. Windows AppModel Runtime records the Codex AppX container being **destroyed at 20:46:48**.
4. Windows creates a new Codex AppX container at **20:47:21**.
5. A user-visible follow-up at 20:50 reported that Codex had “crashed again after using chrome browser,” consistent with that restart window.

Windows Error Reporting also recorded **`RADAR_PRE_LEAK_64` for `codex.exe` at 19:58:49 today**, which is direct evidence of abnormal memory-growth detection. A similar `RADAR_PRE_LEAK_64` entry exists for `ChatGPT.exe` at 22:12:50 on July 12, so the underlying leak signal predates the final update today even though today's builds appear to make browser-triggered restarts more reproducible.

No conventional Application Error fault, crash dump, GPU driver reset, occupied debugging port, or currently orphaned Chromium process was found for the 20:46 failure. That pattern is compatible with abrupt AppX termination/resource failure rather than a normal Chromium exception with a dump.

## Ranked possibilities

### 1. Codex browser bridge leak/lifecycle regression — most likely

Evidence:

- Exact 20:46:45 browser-tool-call → 20:46:48 AppX-container-destroy sequence.
- WER `RADAR_PRE_LEAK_64` for `codex.exe` at 19:58:49.
- The Codex backend stopped without logging a handled error, then restarted under a new container.
- The browser bridge was active through `node_repl` and the bundled Chrome native extension host.
- Codex was updated three times today: `26.707.3748.0 → 26.707.6957.0` at 09:04, `6957.0 → 8479.0` at 10:44, and `8479.0 → 9564.0` at 22:02. The most recent observed crash occurred while package `26.707.8479.0` was installed. Version `9564.0` was installed after that crash and has not been browser-stress-tested in this investigation.
- A previous-night `ChatGPT.exe` RADAR leak signal means the defect may be cumulative and only exposed more reliably by today's browser use rather than being wholly introduced today.

Confidence: high that the crash is inside the Codex/browser integration lifecycle; medium that a specific update introduced it.

### 2. Long-lived Chrome/GPU resource pressure plus a staged Chrome update — plausible contributor

Evidence:

- The user Chrome tree started at 17:40 and remained running throughout multiple Codex sessions.
- Its GPU process accumulated about **1,525 CPU-seconds** and used **~534 MB working set** at the final snapshot; an earlier private-memory sample was approximately **1.37 GB**.
- Chrome `150.0.7871.115` was staged/registered today, while the still-running Chrome tree and `chrome.exe` image remained `150.0.7871.101`. The install directory contains both version folders plus `new_chrome.exe`, indicating an update awaiting a full browser restart.
- Codex's current embedded Chromium reports `150.0.7871.115`, while the user Chrome process reports `.101`. This is not inherently unsupported, but it increases the chance of a native-extension/automation edge case during today's transition.

Counter-evidence:

- The system still had 7.64 GB free RAM, almost no page-file pressure, and no display-driver/GPU-reset events.
- The current Chrome tree has a valid parent and is clearly a normal user-launched tree, not an orphaned Playwright tree.

Confidence: medium as an amplifier, low-to-medium as the sole cause.

### 3. Newly cached Playwright alpha/daemon state — possible secondary conflict

Evidence:

- `playwright-core 1.62.0-alpha-1783623505000` was downloaded into the npm `_npx` cache at 16:47 today.
- It launched headless Chromium using `channel: "chrome"` (the system Chrome), not the separately installed Playwright Chromium.
- A Playwright daemon/session record named `food-covers` and browser pipe metadata were created today.
- A 15.9 MB temporary profile, `playwright_chromiumdev_profile-pbv9d7`, was created at 17:13 and last modified at 17:19; no process currently references it. This is residue from an earlier automation session.
- A separate stable `playwright-core 1.60.0` and cached Playwright Chromium `148.0.7778.96` also exist, so there are multiple Playwright/browser versions on disk.

Counter-evidence:

- The exact 20:46 crash was in Codex's `node_repl` browser bridge, not a Playwright CLI process.
- No Playwright, Chromium, Chrome for Testing, or ChromeDriver process is currently running.
- No stale lock marker was found in the remaining Playwright profile.

Confidence: low-to-medium; worth cleaning only after a controlled retest and with approval.

### 4. Hardware acceleration / GPU-process instability — lower likelihood

Evidence:

- Hardware acceleration is enabled in the Codex Chromium profile.
- Both Codex and Chrome have GPU subprocesses, and the user Chrome GPU process has unusually high cumulative resource use.
- The Codex profile contains active shader caches (`GrShaderCache` ~10.6 MB plus smaller shader caches).

Counter-evidence:

- No `Display`, `nvlddmkm`, `dxgkrnl`, WHEA, GPU-process-crash, or video-hardware event was found in the last 48 hours.
- NVIDIA GTX 1060 6GB reports status OK, driver `32.0.15.8157` dated 2025-10-08.
- Codex Local State reports `system_crash_count: 0`, `exited_cleanly: true` for the current session, and no Chromium GPU crash counter.

Confidence: low as primary cause; reasonable A/B test only if the clean restart test still fails.

### 5. Locked profile, occupied debug port, or orphaned automation process — unlikely

Evidence against:

- No process had a missing parent in the live relevant-process snapshot.
- No process was listening on common DevTools/ChromeDriver ports 9222, 9223, 9229, 9515, or 9516. The only relevant listener was an unrelated Vite dev server on port 3000.
- No live process used `--remote-debugging-port`, `--remote-debugging-pipe`, ChromeDriver, or a Playwright temp profile.
- The Codex browser profile has one `lockfile`, but it belongs to the currently running Codex/ChatGPT Chromium instance and is expected.
- The remaining Playwright profile has no `SingletonLock`, `SingletonSocket`, `SingletonCookie`, `DevToolsActivePort`, or `lockfile` marker.

Confidence: very low.

## Process inventory

CPU below is cumulative process CPU time in seconds, not instantaneous percent. Memory is working set at the final snapshot. Command lines are sanitized and normalized by removing volatile Chromium handle/field-trial arguments; executable, process type, profile, and meaningful service arguments are retained.

Executable paths:

- ChatGPT/Codex UI: `C:\Program Files\WindowsApps\OpenAI.Codex_26.707.9564.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe`
- Codex backend: same package under `app\resources\codex.exe`
- Codex code-mode host: same package under `app\resources\codex-code-mode-host.exe`
- Google Chrome: `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
- Node: `C:\Program Files\nodejs\node.exe`
- Codex Node REPL: `C:\Users\jorda\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node_repl.exe`
- Chrome native extension host: `C:\Users\jorda\.codex\plugins\cache\openai-bundled\chrome\latest\extension-host\windows\x64\extension-host.exe`

### Codex / ChatGPT tree

| PID | Process | Parent | Start | CPU s | WS MB | Command line / role |
|---:|---|---|---|---:|---:|---|
| 18180 | ChatGPT.exe | 15872 / sihost.exe | 22:02:39 | 89.1 | 332.3 | `ChatGPT.exe` (main UI) |
| 7640 | ChatGPT.exe | 18180 / ChatGPT.exe | 22:02:39 | 0.0 | 10.2 | `--type=crashpad-handler --user-data-dir=...\Roaming\Codex\web\Codex --database=...\Crashpad --annotation=ver=150.0.7871.115` |
| 7620 | ChatGPT.exe | 7640 / ChatGPT.exe | 22:02:39 | 0.0 | 7.5 | second monitored `--type=crashpad-handler` |
| 12340 | ChatGPT.exe | 18180 / ChatGPT.exe | 22:02:39 | 149.4 | 117.7 | `--type=gpu-process` |
| 9204 | ChatGPT.exe | 18180 / ChatGPT.exe | 22:02:40 | 0.6 | 37.6 | `--type=utility --utility-sub-type=network.mojom.NetworkService` |
| 18312 | ChatGPT.exe | 18180 / ChatGPT.exe | 22:02:40 | 0.1 | 23.1 | `--type=utility --utility-sub-type=storage.mojom.StorageService` |
| 12104 | ChatGPT.exe | 18180 / ChatGPT.exe | 22:02:47 | 84.0 | 348.4 | `--type=renderer` |
| 13676 | ChatGPT.exe | 18180 / ChatGPT.exe | 22:02:47 | 0.1 | 34.7 | `--type=renderer` |
| 1384 | codex.exe | 18180 / ChatGPT.exe | 22:02:47 | 26.5 | 167.2 | `codex.exe -c features.code_mode_host=true app-server --analytics-default-enabled` |
| 11276 | codex-code-mode-host.exe | 1384 / codex.exe | 22:03:39 | 1.1 | 15.2 | `codex-code-mode-host.exe` |
| 11752 | extension-host.exe | 1896 / cmd.exe → 10324 / chrome.exe | 22:03:07 | 0.0 | 4.6 | Codex Chrome native-messaging extension host; parent chain is valid |

The two crashpad processes are expected Chromium crash-reporting components, not duplicate app instances. No separate `crashpad_handler.exe` exists.

### Google Chrome tree

All Chrome processes below use the same executable path and descend from user-launched main PID 10324. No automation profile or remote-debugging flag appears in this live tree.

| PID | Parent | Start | CPU s | WS MB | Command line / role |
|---:|---|---|---:|---:|---|
| 10324 | 8928 / explorer.exe | 17:40:56 | 284.3 | 620.2 | `chrome.exe` (main browser, version 150.0.7871.101) |
| 19056 | 10324 / chrome.exe | 17:40:56 | 0.1 | 9.6 | `--type=crashpad-handler --user-data-dir=...\Google\Chrome\User Data --annotation=ver=150.0.7871.101` |
| 8284 | 10324 / chrome.exe | 17:40:56 | 1525.2 | 534.1 | `--type=gpu-process` |
| 2124 | 10324 / chrome.exe | 17:40:56 | 6.1 | 31.2 | storage utility |
| 13460 | 10324 / chrome.exe | 17:40:56 | 87.3 | 82.5 | network utility |
| 9864 | 10324 / chrome.exe | 17:40:57 | 0.3 | 56.4 | renderer / extension process |
| 1156 | 10324 / chrome.exe | 17:41:01 | 6.8 | 121.8 | renderer |
| 19180 | 10324 / chrome.exe | 18:19:56 | 1.1 | 51.8 | renderer / extension process |
| 17200 | 10324 / chrome.exe | 18:28:41 | 0.3 | 77.9 | video-capture utility |
| 17696 | 10324 / chrome.exe | 18:28:41 | 1.5 | 24.9 | audio utility |
| 17108 | 10324 / chrome.exe | 19:00:02 | 5.5 | 134.8 | renderer |
| 12272 | 10324 / chrome.exe | 20:55:35 | 0.2 | 51.6 | renderer |
| 13616 | 10324 / chrome.exe | 21:32:34 | 196.9 | 612.3 | renderer |
| 12548 | 10324 / chrome.exe | 22:00:53 | 29.7 | 352.6 | renderer |
| 8364 | 10324 / chrome.exe | 22:06:21 | 86.4 | 476.6 | renderer |
| 19688 | 10324 / chrome.exe | 22:06:21 | 0.2 | 69.3 | renderer |
| 17352 | 10324 / chrome.exe | 22:09:29 | 0.0 | 29.9 | renderer |

Chrome renderer counts changed normally during the scan as tabs/pages changed. The main, GPU, crashpad, and service parentage stayed coherent.

### Node and automation helpers

| PID | Process | Parent | Start | CPU s | WS MB | Command line / role |
|---:|---|---|---|---:|---:|---|
| 4736 | node.exe | 1384 / codex.exe | 22:03:24 | 0.0 | 47.1 | `node ./mcp/server.mjs` |
| 10752 | node.exe | 1384 / codex.exe | 22:03:24 | 0.0 | 46.7 | `node ./mcp/server.mjs` |
| 18832 | node.exe | 1384 / codex.exe | 22:03:24 | 0.2 | 61.0 | `node ./mcp/server.bundle.mjs` |
| 19264 | node.exe | 1384 / codex.exe | 22:03:24 | 0.3 | 60.2 | `node ./mcp/server.mjs --stdio` |
| 256 | node_repl.exe | 1384 / codex.exe | 22:03:24 | 0.0 | 7.9 | Codex CUA Node REPL |
| 3900 | node.exe | 1384 / codex.exe | 22:03:26 | 0.2 | 61.3 | `node ./mcp/server.bundle.mjs` |
| 2980 | node.exe | 1384 / codex.exe | 22:03:26 | 0.0 | 47.3 | `node ./mcp/server.mjs` |
| 18008 | node.exe | 1384 / codex.exe | 22:03:26 | 0.0 | 47.0 | `node ./mcp/server.mjs` |
| 18700 | node.exe | 1384 / codex.exe | 22:03:26 | 0.2 | 60.2 | `node ./mcp/server.mjs --stdio` |
| 7548 | node_repl.exe | 1384 / codex.exe | 22:03:26 | 0.0 | 7.6 | Codex CUA Node REPL |
| 5584 | node.exe | 6376 / powershell.exe | 20:57:09 | 0.2 | 45.2 | unrelated `npm run dev` |
| 13016 | node.exe | 19424 / cmd.exe | 20:57:09 | 3.4 | 152.7 | unrelated Vite dev server, `--port=3000 --host=0.0.0.0` |

The eight MCP Node processes and two Node REPL processes are multiple by design and all have the live Codex backend as parent. The two 20:57 Node processes belong to a separate project/dev server and are not orphaned.

No running executable matched `chromium`, `playwright`, `chromedriver`, `Chrome for Testing`, `electron`, or standalone `crashpad_handler`.

## Persistence and profile-lock findings

- **No currently orphaned automation process:** every relevant process had a live parent. No Playwright/Chromium/ChromeDriver process survived the previously crashed Codex session.
- **Normal user Chrome persisted across Codex restarts:** PID 10324 was launched by Explorer at 17:40 and remained open. This is not an orphan, but it preserved the old `.101` Chrome image while `.115` was staged.
- **Stale Playwright data:** `C:\Users\jorda\AppData\Local\Temp\playwright_chromiumdev_profile-pbv9d7` (15.9 MB, 17:13–17:19) is not referenced by any live process and has no lock marker. Many older empty Playwright profile/artifact directories also exist.
- **Persistent Playwright daemon metadata, not a live daemon:** `C:\Users\jorda\AppData\Local\ms-playwright\daemon\...\food-covers.session` and `...\b\browser@...` remain, but no running process owns their named pipes in the process inventory.
- **Codex profile:** `C:\Users\jorda\AppData\Roaming\Codex\web\Codex` is approximately 955 MB. `Default` accounts for ~770 MB, `codex-browser-app` ~20 MB, and `GrShaderCache` ~10.6 MB. Personal profile contents were not inspected.
- **Codex lock:** one zero-byte `lockfile` is present and expected while the current Codex Chromium instance is running. No duplicate lock family was found.

## Event Viewer and log findings

### Relevant Windows events in the last 48 hours

- 2026-07-13 20:46:48 — AppModel Runtime: destroyed the Codex AppX container for package `OpenAI.Codex_26.707.8479.0`.
- 2026-07-13 20:47:21 — AppModel Runtime: created a new container/process for the same package.
- 2026-07-13 19:58:49 — WER `RADAR_PRE_LEAK_64`, `codex.exe`.
- 2026-07-12 22:12:50 — WER `RADAR_PRE_LEAK_64`, `ChatGPT.exe`, Chromium `150.0.7871.101`.
- 2026-07-13 22:02:38 — AppX servicing forcibly shut down the running Codex app to update `8479.0 → 9564.0`; this is a known update shutdown, not the 20:46 crash.
- Multiple AppX cleanup events reported access-denied failures deleting old Codex package binaries after updates. These concern old package removal and do not prove the active package was corrupt.
- No matching Application Error, AppHang, Chrome crash, Electron crash, crashpad crash, GPU-process crash, display-driver reset, or WHEA event was found during the 20:46 window.

### Codex/ChatGPT logs and dumps

- The Codex SQLite log has the browser tool-call boundary and abrupt stop described above. No fatal message or orderly shutdown follows it.
- Sentry queue is empty; the current Sentry scope contains no exception. Only release/session metadata was examined.
- Current Codex Crashpad directories contain settings/metadata but no recent `.dmp` file.
- `%LOCALAPPDATA%\CrashDumps` contains no relevant recent dump.
- WER retained the RADAR events but no accessible recent archived Codex dump/report payload.
- Logs and report output were sanitized; tokens, cookies, authorization data, URLs, and personal browser contents are intentionally omitted.

## System pressure and versions

| Item | Finding |
|---|---|
| RAM | 15.93 GB total, 7.64 GB free at scan time |
| Virtual memory | 23.18 GB total, 13.15 GB free |
| Page file | 7.25 GB allocated, 0.05 GB in use, 0.08 GB peak since boot |
| Disk C: | 116 GB free (25%) |
| Disk F: | 350.4 GB free (75.2%) |
| Last boot | 2026-07-13 16:43:10 EDT |
| GPU | NVIDIA GeForce GTX 1060 6GB; driver `32.0.15.8157`, 2025-10-08, status OK |
| Codex package | current `26.707.9564.0`, installed 22:02 after the last observed crash |
| Codex Chromium | `150.0.7871.115` in current process annotations |
| Chrome | running `.101`; `.115` registered/staged today and awaiting full restart |
| Node.js | `24.13.1`, unchanged since February 2026 |
| Playwright stable | `playwright-core 1.60.0`, cached Chromium `148.0.7778.96` |
| Playwright alpha | `1.62.0-alpha-1783623505000`, cached by npx at 16:47 today |
| Debug ports | none on 9222/9223/9229/9515/9516; no remote-debugging flag |

System-wide RAM, page file, and disk exhaustion are not supported by the snapshot. Per-process leakage remains supported by WER and would not require total system exhaustion to destabilize Codex.

## Yesterday-versus-today correlation

- July 12 had apparently successful browser runs, but WER still detected a `ChatGPT.exe` pre-leak at 22:12. This suggests the defect could accumulate without crashing every run.
- Today, Codex changed builds three times and the system Chrome update staged a new build while the old Chrome process remained live.
- The Playwright alpha package and daemon metadata first appeared today at 16:47.
- The earlier Playwright browser session ran at 17:13–17:19. The exact later Codex restart ran at 20:46:45–20:47:21 during `node_repl` browser use.
- Therefore, today's crashes correlate most strongly with **browser activity on a rapidly changing Codex/browser stack**, with a pre-existing leak signal as the underlying mechanism. The evidence does not isolate a single Chrome, Playwright, or GPU binary as the sole cause.

## Safest recommended next step

After reviewing this report, approve a **single controlled clean-restart test** before deleting or reinstalling anything:

1. Save work and close Codex and all Chrome windows normally.
2. Verify that ChatGPT/Codex, their Node helpers, the Chrome extension host, and Chrome have exited; only terminate a leftover process if you separately approve it.
3. Reboot Windows so Chrome completes `.101 → .115` and all named pipes/GPU contexts are reset.
4. Launch the now-current Codex `26.707.9564.0` with Chrome initially closed.
5. Perform one browser-automation action while recording Codex, ChatGPT renderer/GPU, and Chrome memory. Stop after the first failure; do not loop launches.

This test separates “old process/update skew” from a persistent Codex browser-bridge defect without touching browser data or installations. No part of this test was performed during the diagnostic scan.

## Proposed cleanup or A/B actions requiring approval

These are proposals only, ordered from least invasive to most invasive:

1. Close applications normally, then terminate only verified leftover Codex/ChatGPT/Chrome/Node/extension-host processes.
2. Remove the unreferenced `playwright_chromiumdev_profile-pbv9d7` and old empty Playwright temp/artifact directories.
3. Remove stale Playwright daemon/session metadata for `food-covers` after confirming no Playwright process is live.
4. Remove the npx-cached Playwright `1.62.0-alpha` or pin automation to the existing stable Playwright version; this changes installed/cached tooling.
5. Clear only Codex GPU/shader caches (`GPUCache`, `GrShaderCache`, `ShaderCache`, `Dawn*Cache`) for an A/B test. Do not clear cookies, history, Local Storage, or other browser data.
6. Temporarily disable Codex hardware acceleration for one controlled test.
7. Back up and rename/reset the 955 MB Codex browser profile if cache-only testing fails. This is substantially more disruptive and may require reauthentication.
8. Roll back Codex to the last known-good build or install a newer fixed build if `26.707.9564.0` still reproduces the crash.

None of these actions has been taken.
