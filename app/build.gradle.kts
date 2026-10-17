plugins { id("com.android.application") }

android {
    namespace = "nl.mrtherich.schattepatatjes"
    compileSdk = 36

    defaultConfig {
        // Existing application ID and permanent signing certificate are essential for updates.
        applicationId = "nl.mrtherich.schattepatatjes"
        minSdk = 24
        targetSdk = 35
        versionCode = 7
        versionName = "0.6.0"
    }

    signingConfigs {
        create("stable") {
            val path = System.getenv("SCHATTEPATATJES_KEYSTORE_PATH")
            val password = System.getenv("SCHATTEPATATJES_SIGNING_PASSWORD")
            if (!path.isNullOrBlank() && !password.isNullOrBlank()) {
                storeFile = file(path)
                storePassword = password
                keyAlias = "schattepatatjes"
                keyPassword = password
            }
            enableV1Signing = true
            enableV2Signing = true
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("stable")
        }
        getByName("debug") { isMinifyEnabled = false }
    }
    // One shared web codebase for web/PWA and embedded Android assets.
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/familyWeb").get().asFile)
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.core:core-ktx:1.17.0")
}

val bundleWeb by tasks.registering(Copy::class) {
    from(rootProject.layout.projectDirectory.dir("web")) {
        include("index.html", "app.js", "styles.css", "manifest.webmanifest", "assets/**")
        // Static web files only. PHP, credentials and storage are outside web/.
    }
    into(layout.buildDirectory.dir("generated/familyWeb"))

}
tasks.named("preBuild") { dependsOn(bundleWeb) }
