rootProject.name = "tool"
include(*file("modules").list().orEmpty())
include("docs")
project(":docs").projectDir = file("documentation")
