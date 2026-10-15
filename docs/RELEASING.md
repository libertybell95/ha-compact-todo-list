# Releasing and maintenance

## Versioning

The project follows [Semantic Versioning](https://semver.org/):

| Change                                                               | Bump  |
| -------------------------------------------------------------------- | ----- |
| Bug fix, no configuration change                                     | patch |
| New option or feature; existing configurations keep working          | minor |
| Removed or renamed option, or changed default behavior users rely on | major |

Versions stay in `0.x` until every item in [Live verification](#live-verification-checklist) has passed on a real Home Assistant instance.

## How HACS finds releases

- HACS reads `hacs.json`, which sets `filename: ha-compact-todo-card.js`.
- HACS looks for that file in `dist/` on the default branch first, then in the latest GitHub release. `dist/` is gitignored, so HACS uses the asset attached to the release.
- The version shown in HACS is the GitHub release tag. A tag alone, without a published release, is not enough.
- HACS ignores pre-releases unless the user turns on beta versions for this card.

## Release procedure

1. Update `CHANGELOG.md`: move entries from **Unreleased** to a new version heading with the date.
2. Bump the version without creating a tag: `npm version <patch|minor|major> --no-git-tag-version`.
3. Run `npm run check` locally.
4. Commit (`chore: release vX.Y.Z`), open a pull request, and wait for **CI** and **HACS validation** to pass. Merge it.
5. Tag the merged commit and push the tag:

   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

6. The **Release** workflow runs automatically. It fails if the tag doesn't match `package.json` or if `CHANGELOG.md` has no section for the version. It then runs every check, builds the bundle, and creates the GitHub release with `ha-compact-todo-card.js` already attached and the changelog section as notes.
7. Confirm the release lists the `.js` asset. Then, in a Home Assistant instance, choose **HACS → Compact To-Do Card → Update information** and check that the new version is offered.

Don't create releases by hand in the GitHub UI or with `gh release create`. A release published before its `.js` file is attached is reported by HACS as "Repository structure for vX.Y.Z is not compliant", and HACS may cache that result until someone chooses **Update information**.

To publish a release candidate, use a tag like `vX.Y.Z-rc.1`; the workflow marks it as a pre-release. Only HACS users who have turned on beta versions for this card will get it. The version in `package.json` must match, e.g. `X.Y.Z-rc.1`.

## Rollback

**For users:** in HACS, open the card's menu, choose **Redownload**, and pick an earlier version (HACS lists the last five releases). Then reload the browser.

**For maintainers:**

1. Don't delete or re-tag a published release. HACS and users may have cached it.
2. Edit the bad release on GitHub and mark it **Set as a pre-release**. HACS then stops offering it to most users.
3. Ship the fix, or a revert, as a new patch release (for example `v0.2.1`). Users then update normally.

## Live verification checklist

Automated tests run against a simulated Home Assistant. Before calling a release stable, run through the following on a live instance and record the Home Assistant version in the README's Compatibility section.

- [ ] The card loads after a HACS install. The resource is added automatically, or manually as documented.
- [ ] The card appears in the card picker with a preview. The visual editor shows every option, and the entity picker lists only `todo.*` entities.
- [ ] Tasks from an existing list (for example `todo.ksi`) appear. Collapsed rows are about 36 px tall.
- [ ] Tapping a title expands it, and tapping the checkbox doesn't. Accordion mode works.
- [ ] Add, complete, restore, edit (title, description, due date, due date with time) and delete with confirmation all work.
- [ ] Editing a task's title keeps its description and due date.
- [ ] A change made in another dashboard, the built-in to-do card, or an automation appears without reloading.
- [ ] Stopping Home Assistant shows the "Disconnected" warning. After restart, the list resyncs.
- [ ] Disabling the to-do integration shows the unavailable or error state.
- [ ] A **Shopping list** entity (titles only) hides description and due date fields.
- [ ] Light and dark themes, a custom theme, and the `theme:` option all look right.
- [ ] Works in Sections, Masonry and Panel views, in the iOS and Android Companion apps, and at phone width without sideways scrolling.
- [ ] Leaving and reopening the dashboard repeatedly doesn't increase memory use. Check the browser's Performance → Memory panel.
