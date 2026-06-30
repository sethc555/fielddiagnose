plugins {
    id("com.android.application") version "8.7.3"
}

android {
    namespace = "org.fielddiagnose"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.fielddiagnose"
        minSdk = 31
        targetSdk = 35
        versionCode = 11
        versionName = "0.1.10"
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            // F-Droid builds from source and signs with its OWN key, so the default release is
            // unsigned. For self-distribution / sideload APKs, pass -PselfSign to debug-sign it
            // (so it installs without going through F-Droid).
            if (project.hasProperty("selfSign")) {
                signingConfig = signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Single source of truth: the offline web app lives in the repo root; bundle it into the APK's
// assets at build time so it never drifts from the served version / the node-tested engine.
val copyWeb by tasks.registering(Copy::class) {
    from(rootProject.projectDir.parentFile) { include("index.html", "engine.js", "refrigerant_pt.js", "electrical_sequences.js") }
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }
