# Field Diagnose on F-Droid — status & how it's wired

**Status:** submitted to the official F-Droid catalog as
[fdroiddata!41764](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/41764), awaiting review.

F-Droid doesn't take an uploaded APK — it builds from source on its own infrastructure. This app is
set up for **reproducible builds**: F-Droid rebuilds the tagged commit *unsigned* and verifies it
byte-matches the developer-signed APK we publish, then distributes that developer-signed APK. The
F-Droid build and the GitHub-release build therefore share one signature.

## The recipe (`org.fielddiagnose.yml`)
Submitted to fdroiddata as `metadata/org.fielddiagnose.yml`. Key fields:
- `RepoType: git` + `Repo:` — this repo.
- `Builds:` — one entry per version, pinned to the **full commit hash** (not a tag) of `vX.Y.Z`,
  with `subdir: android` and `gradle: [yes]`.
- `Binaries:` — the GitHub-release APK URL (`…/download/v%v/FieldDiagnose-%v.apk`) F-Droid verifies against.
- `AllowedAPKSigningKeys:` — the SHA-256 of the release signing key.
- `UpdateCheckMode: Tags` + `AutoUpdateMode: Version` — every future `vX.Y.Z` tag is picked up
  automatically; F-Droid opens the update MR itself.

Listing text, changelog and screenshots come from `fastlane/metadata/android/en-US/` (F-Droid reads
them from the repo), so they are not duplicated in the recipe.

## Verify the build locally (what F-Droid CI does)
```sh
pip install fdroidserver
# from an fdroid workspace containing metadata/org.fielddiagnose.yml:
fdroid lint  org.fielddiagnose
fdroid build org.fielddiagnose:<versionCode>   # builds + verifies the reproducible binary
```
A green `fdroid build` ("compared built binary to supplied reference binary successfully") means the
F-Droid CI build should pass.

## The fork pipeline shows "failed" — that's expected
The fork's own CI pipeline fails with **zero jobs** because the account has no shared-runner access —
nothing actually ran, so it isn't a build failure. Per fdroiddata's template, F-Droid maintainers
trigger CI on their side. Don't add a phone/credit card to "fix" it, and don't edit `.gitlab-ci.yml`.
(You can disable CI/CD on the fork to stop the failure emails: fork → Settings → General → Visibility,
project features, permissions → CI/CD → off.)

## Ongoing releases
See [../RELEASE.md](../RELEASE.md): bump the version, tag `vX.Y.Z`, build the signed APK, publish it as
`FieldDiagnose-X.Y.Z.apk` on GitHub Releases — F-Droid autoupdate does the rest, no new MR per release.

## Note on the campus_twin build
This is the standalone, campus-free app (`org.fielddiagnose`). The campus_twin variant
(`org.campustwin.fieldapp`, backend-connected) is a separate downstream and is **not** for F-Droid.
