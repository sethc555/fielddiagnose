import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application") version "8.7.3"
}

// Reproducible Builds: the developer signs the release with this keystore and publishes it; F-Droid
// rebuilds from source UNSIGNED and verifies it byte-matches, then distributes the developer-signed
// APK. keystore.properties + the .jks are gitignored, so they're absent from F-Droid's checkout —
// there the release stays unsigned, which is exactly what the reproducibility check needs.
val ksFile = rootProject.file("keystore.properties")
val ksProps = Properties().apply { if (ksFile.exists()) load(FileInputStream(ksFile)) }

android {
    namespace = "org.fielddiagnose"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.fielddiagnose"
        minSdk = 31
        targetSdk = 35
        versionCode = 12
        versionName = "0.1.11"
    }

    signingConfigs {
        if (ksFile.exists()) {
            create("release") {
                storeFile = rootProject.file(ksProps.getProperty("storeFile"))
                storePassword = ksProps.getProperty("storePassword")
                keyAlias = ksProps.getProperty("keyAlias")
                keyPassword = ksProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (ksFile.exists()) signingConfig = signingConfigs.getByName("release")
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
