# Releasing Field Diagnose

## ⚠️ The release keystore — guard it
The app is signed with a developer release key held in two **gitignored** files:
- `android/fielddiagnose-release.jks` — the keystore
- `android/keystore.properties` — the passwords + key alias

**These are the app's identity.** Back them up somewhere safe and offline (e.g. an encrypted vault).
- **Lose them** → you can never ship a same-signature update again (you'd have to change the
  `applicationId`, i.e. ship a "new app").
- **Leak them** → someone can sign malicious updates that users' devices will accept.

They are never committed (see `android/.gitignore`). The signing key's SHA-256 — public, pinned in
the F-Droid recipe as `AllowedAPKSigningKeys` — is:
`091a391a25e39447e0534afc6b6184233c3e157675bac13881ec787c868f49a8`

## Cut a release
1. Bump `versionCode` (+1) and `versionName` in `android/build.gradle.kts`.
2. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`.
3. `node test_engine.js` — engine tests pass.
4. Commit, then tag and push:
   ```sh
   git tag -a vX.Y.Z -m "Field Diagnose vX.Y.Z"
   git push origin main --tags
   ```
5. Build the signed APK (works because `keystore.properties` is present):
   ```sh
   cd android && ./gradlew clean assembleRelease
   # -> android/build/outputs/apk/release/fielddiagnose-release.apk
   ```
6. Publish a GitHub release **on tag `vX.Y.Z`** with the APK renamed to **`FieldDiagnose-X.Y.Z.apk`**
   (the exact name the recipe's `Binaries` URL expects):
   ```sh
   gh release create vX.Y.Z FieldDiagnose-X.Y.Z.apk --repo sethc555/fielddiagnose \
     --title "Field Diagnose vX.Y.Z" --notes "..."
   ```

That's all F-Droid needs: `UpdateCheckMode: Tags` + `AutoUpdateMode: Version` detect the new tag,
build it reproducibly, verify it against your published APK, and publish — **no fdroiddata MR per
release** (only the first inclusion needed one).

## Keep it reproducible
F-Droid re-verifies reproducibility every release. If a toolchain bump breaks the byte-match, check
locally by building once **with** `keystore.properties` (signed) and once **without** it (unsigned),
then:
```sh
apksigcopier compare fielddiagnose-release.apk --unsigned fielddiagnose-release-unsigned.apk
```
Keep the AGP version (in `android/build.gradle.kts`) and the Gradle wrapper version stable across
releases to stay reproducible.
