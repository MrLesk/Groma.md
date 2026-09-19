# GitHub revision source

The optional adapter supports github.com. It uses the authenticated GitHub CLI
for public and private repository access. Groma never stores a token.

Enable it in **Settings → Plugins → Revision sources**. Install GitHub CLI and
run `gh auth login --hostname github.com` if readiness requests it. Select a
repository from the checkout's HTTPS or SSH GitHub remotes. Enablement and the
repository name are stored in local Git configuration under
`groma.github.enabled` and `groma.github.repository`.

Branches and PRs appear in the existing revision selector. PR discovery offers
open, closed, merged and all states. Search is repository-scoped text search,
using GitHub GraphQL search and its opaque page cursor. Queries exceeding
GitHub's 1,000-result limit ask for a narrower search. Branch REST has no name
search, so branch-name search reads every branch page before filtering.
Without a search, branch pages load on demand.

Resolving a PR reads its current head SHA and resolves its base branch's latest
tip. It never substitutes a merge base or synthetic merge commit. Missing
selected commits are fetched into a unique `refs/groma/revisions/` session
namespace; fork heads use `refs/pull/<number>/head`. The acquired object is
verified against the selected SHA. A moving ref asks the user to refresh.
The adapter uses gh's credential helper for private HTTPS fetches without
changing the user's credential settings.

Closing the session aborts pending commands and deletes only refs owned by that
session. No checkout, staging, commit, user-branch update, PR write, polling,
webhook or automatic retry is performed. Discovery failures stay in this source;
local Git remains available. Provider entries return ordinary committed states
to Groma's shared comparison engine. Historical architecture must already be
stored and readable at those commits.

Command tests use injected responses and require no network or credentials.
The package is bundled at the application composition point in both source
execution and the compiled CLI.

References: [GitHub branches](https://docs.github.com/en/rest/branches/branches),
[GitHub CLI API](https://cli.github.com/manual/gh_api),
[PR head refs](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/checking-out-pull-requests-locally).
