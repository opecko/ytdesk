#!/usr/bin/env bash
# Publishes locally built packages from release/<version>/ as a GitHub release, with a changelog. Tags HEAD as
# v<version> if the tag doesn't exist yet and pushes the branch and tag. An existing release gets its files replaced.
# Hand-written highlights in release/notes/<version>.md (optional) go above the generated changelog.
#   scripts/publish.sh            # version from src-tauri/tauri.conf.json
#   scripts/publish.sh 1.2.0
set -euo pipefail
cd "$(dirname "$0")/.."

ver=${1:-$(jq -r .version src-tauri/tauri.conf.json)}
tag=v$ver
dir=release/$ver
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

command -v gh >/dev/null || die "missing 'gh' (GitHub CLI)"
gh auth status >/dev/null 2>&1 || die "not signed in to gh (gh auth login)"
[ -f "$dir/SHA256SUMS" ] || die "no packages in $dir; run scripts/release.sh first"
(cd "$dir" && sha256sum --quiet -c SHA256SUMS) || die "$dir doesn't match its SHA256SUMS"

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "tag $tag exists ($(git rev-parse --short "$tag^{commit}"))"
else
  [ -z "$(git status --porcelain --untracked-files=no)" ] || die "uncommitted changes; commit before tagging $tag"
  git tag "$tag"
  echo "tagged HEAD as $tag"
fi
git push -q origin HEAD
git push -q origin "$tag"

export GITHUB_REPOSITORY
GITHUB_REPOSITORY=$(gh repo view --json nameWithOwner -q .nameWithOwner)
notes=$(mktemp)
trap 'rm -f "$notes"' EXIT
extra=release/notes/$ver.md
{ [ -f "$extra" ] && { cat "$extra"; echo; }; scripts/changelog.sh "$tag"; } > "$notes"

files=("$dir"/*)
if gh release view "$tag" >/dev/null 2>&1; then
  gh release edit "$tag" --notes-file "$notes"
  gh release upload "$tag" "${files[@]}" --clobber
else
  gh release create "$tag" "${files[@]}" --verify-tag --title "ytdesk $ver" --notes-file "$notes"
fi
gh release view "$tag" --json url -q .url
