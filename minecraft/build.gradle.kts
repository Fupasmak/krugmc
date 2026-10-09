plugins {
    `java-library`
}

group = "ru.krugmc"
version = "1.0.0"

java {
    toolchain {
        // Paper 26.2 требует Java 25
        languageVersion.set(JavaLanguageVersion.of(25))
    }
}

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/") {
        name = "papermc"
    }
}

dependencies {
    // Paper публикует API как <версия игры>.build.<номер>-stable
    compileOnly("io.papermc.paper:paper-api:26.2.build.128-stable")
}

tasks {
    compileJava {
        options.encoding = "UTF-8"
        options.release.set(25)
    }

    processResources {
        filteringCharset = "UTF-8"
        val properties = mapOf("version" to project.version)
        inputs.properties(properties)
        filesMatching("plugin.yml") {
            expand(properties)
        }
    }

    jar {
        archiveBaseName.set("krug")
    }
}
