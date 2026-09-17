plugins {
    java
}

val javaRelease: String by project

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

tasks.withType<JavaCompile> {
    options.release.set(javaRelease.toInt())
}

sourceSets {
    main {
        java.srcDir("src/extra/java")
        java.srcDir(layout.buildDirectory.dir("generated/sources"))
    }
}
