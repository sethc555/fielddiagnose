# Field Diagnose — offline HVAC field diagnostics for any phone

A free, open, **offline** Android app that turns the readings off your **analog gauges, multimeter,
and a line thermometer** into a real diagnosis — refrigerant charge, airflow, electrical, and
delivered capacity — with **no account, no cloud, no Bluetooth probes, no subscription**.

The diagnostic apps techs know (HVAC Buddy, Emerson Check & Charge, iManifold, the smart-probe apps)
are proprietary, online, and often tied to a hardware ecosystem. Field Diagnose is the open
alternative for the tech with basic tools and the under-resourced shop — it does the math a ~$300
digital manifold does, from gauges you already own.

## What it does
- **Charge:** suction/head pressure → saturation (built-in P-T table, 23 refrigerants) →
  superheat/subcool vs target. TXV judged by subcool; fixed-orifice **target superheat is computed
  from indoor wet-bulb + outdoor dry-bulb** (the field charging chart).
- **Air-side:** Delta-T, full **psychrometrics** (wet-bulb / dew point / enthalpy / grains) and
  **delivered capacity** — sensible / latent / total BTU/h, SHR, and % of nominal tons.
- **Electrical:** running amps vs nameplate RLA/LRA, run-capacitor µF vs rating, locked-rotor —
  plus **13 guided multimeter troubleshooting sequences** (an interactive pass/fail wizard).
- **Condenser split**, a live **P-T chart**, a **0–100 system health score**, and a **shareable
  text / PDF service report**.
- **Optional:** a GPS → NOAA (api.weather.gov) button to auto-fill the outdoor-air temp. It's the
  only network feature; the diagnosis itself is fully offline.

## How it works offline
A phone can't run a refrigerant-property library, so `build_pt_table.py` precomputes saturation
physics (via [CoolProp](http://www.coolprop.org/)) into `refrigerant_pt.js` (gauge psig →
[bubble °F, dew °F]). `engine.js` is the dependency-free diagnosis; `index.html` is the UI; the
Android app is a thin WebView over those bundled assets. No network is required to diagnose.

## Files
| file | what |
|---|---|
| `engine.js` | pure-function diagnosis — charge, psychrometrics, capacity, electrical, health score |
| `refrigerant_pt.js` / `.json` | the offline P-T table (generated — don't hand-edit) |
| `build_pt_table.py` | regenerates the table (needs Python + CoolProp) |
| `electrical_sequences.js` | the 13 guided troubleshooting sequences (data-driven) |
| `index.html` | the phone UI (open it in a browser, or build the APK) |
| `test_engine.js` | `node test_engine.js` — engine unit tests against textbook values |
| `android/` | the WebView APK project |

## Install
- **F-Droid** — submitted for inclusion; the build is reproducible and developer-signed, so once
  merged it shows up in the F-Droid client and updates automatically.
- **Direct download** — grab the latest `FieldDiagnose-x.y.z.apk` from the
  [Releases](https://github.com/sethc555/fielddiagnose/releases) page and sideload it. It's signed
  with the project's release key — the same signature F-Droid publishes.

## Build the APK
Needs an Android SDK + Gradle (compileSdk 35, minSdk 31, Java 17). It's a single Gradle module
rooted at `android/`:

```sh
cd android
echo "sdk.dir=/path/to/android-sdk" > local.properties
./gradlew assembleRelease          # uses the committed Gradle wrapper
```

A `copyWeb` task bundles the web files (`index.html`, `engine.js`, `refrigerant_pt.js`,
`electrical_sequences.js`) into the APK's assets at build time, so the app never drifts from the
node-tested engine. **Signing:** if `android/keystore.properties` is present the release is signed
with your release key; otherwise it builds **unsigned** — the split that lets F-Droid do a
[reproducible build](https://f-droid.org/docs/Reproducible_Builds) (rebuild from source and verify it
byte-matches the developer-signed APK).

## Releasing
Cutting a version — and the release keystore you must back up — are documented in [RELEASE.md](RELEASE.md).

## Status & scope
The engine is unit-tested against textbook values; the app has been used in the field during
development. For **qualified technicians** — a diagnostic aid, not a substitute for training or for
following equipment and safety procedures. The gas-side troubleshooting sequences carry
combustion-safety notes but the app does not replace a combustion analyzer.

## License
GPL-3.0-or-later. See [LICENSE](LICENSE).
