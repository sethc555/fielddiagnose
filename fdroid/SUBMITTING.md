# Getting Field Diagnose into F-Droid

F-Droid does **not** take an uploaded APK. It builds the app from source on its own
server and signs it with the F-Droid key. You submit a small *recipe* (the YAML in this
folder) that points at a git tag; F-Droid builds that tag.

## What's already done in this repo
- GPL-3.0 license, no proprietary/Google dependencies, builds from the CLI.
- Gradle **wrapper** committed (`android/gradlew`) — F-Droid builds with it.
- Release is **unsigned by default** (F-Droid signs it). `-PselfSign` debug-signs for sideloading.
- `fastlane/metadata/android/en-US/` — title, descriptions, changelog, screenshot (F-Droid reads these).
- A tagged release: `v0.1.9` (versionCode 10).

## Submit to the official F-Droid catalog
1. Make sure the tag is pushed: `git push --tags` (tag `v0.1.9` must be on GitHub).
2. Create a GitLab account and **fork** https://gitlab.com/fdroid/fdroiddata
3. Add this file as `metadata/org.fielddiagnose.yml` in your fork.
4. (Optional, recommended) Test the build locally with the F-Droid tooling:
   `pip install fdroidserver` then `fdroid build -v org.fielddiagnose:10`
   (full validation uses their buildserver/Docker image).
5. Open a **Merge Request** to fdroiddata. F-Droid CI builds the recipe and a reviewer checks it.
   - If CI complains about the gradle project location, adjust `subdir:` (try `android` vs `android/app`).
   - Reviewers may add anti-feature tags for the optional network (NOAA) / location — both are
     disclosed in the description; NOAA is a free public service.
6. Once merged, F-Droid builds, signs, and publishes. Because `UpdateCheckMode: Tags` +
   `AutoUpdateMode: Version` are set, every future `vX.Y.Z` tag is picked up automatically.

Timeline: first inclusion usually takes a few weeks (review queue).

## Faster alternative: IzzyOnDroid
IzzyOnDroid is an F-Droid-compatible repo that distributes the developer's **own** signed
APK from GitHub Releases (much faster to get listed). For that route you need a **stable
release keystore** (not the debug key) so updates verify — generate one and sign the
GitHub-release APK with it. Users then add the IzzyOnDroid repo URL in their F-Droid client.

## Note on the campus_twin build
This is the standalone, campus-free app (`org.fielddiagnose`). The campus_twin variant
(`org.campustwin.fieldapp`, backend-connected) is a separate downstream and is **not** for F-Droid.
