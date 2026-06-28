plugins {
    id("com.android.application")
}

android {
    namespace = "org.fielddiagnose"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.fielddiagnose"
        minSdk = 31
        targetSdk = 35
        versionCode = 9
        versionName = "0.1.8"
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            // Self-distribution / sideload to GrapheneOS: sign release with the debug key so it installs.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Single source of truth: the offline web app lives in the parent fieldapp/ dir; bundle it into the
// APK's assets at build time so it never drifts from the served version / the node-tested engine.
val copyWeb by tasks.registering(Copy::class) {
    from(rootProject.projectDir.parentFile) { include("index.html", "engine.js", "refrigerant_pt.js", "electrical_sequences.js") }
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }
