#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
groma_root=$(CDPATH= cd -- "$script_dir/../.." && pwd)
target_repo=${1:-"$groma_root/../MassTransit"}
scanner_project="$script_dir/src/Groma.DotNetScanner.csproj"
scanner_dll="$script_dir/src/bin/Debug/net10.0/Groma.DotNetScanner.dll"
trial_dir=$(mktemp -d "${TMPDIR:-/tmp}/groma-masstransit-scan.XXXXXX")
trap 'rm -rf "$trial_dir"' EXIT HUP INT TERM

git -C "$target_repo" archive --format=tar HEAD | tar -xf - -C "$trial_dir"
DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet build "$scanner_project" --nologo --verbosity quiet >&2
DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet restore "$trial_dir/MassTransit.sln" -p:NuGetAudit=false >&2
DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet "$scanner_dll" "$trial_dir/MassTransit.sln"
