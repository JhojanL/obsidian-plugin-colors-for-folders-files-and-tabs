# Security policy

## Supported versions

Security fixes target the latest published release, with development on the
default branch. Older releases are not maintained separately. Desktop Obsidian
**1.14.4 or later** is required.

Runtime uses vault path/type metadata and this plugin's local settings. It makes
no network requests and does not read or edit note contents. Development and
release automation are separate from the installed plugin.

## Report a suspected vulnerability

Use this repository's **Security → Advisories → Report a vulnerability** button
on GitHub. Include a summary, affected versions/environment, reproduction steps
if known and possible impact. Uncertain reports are welcome; you do not need a
complete exploit or proof that Obsidian itself is unaffected.

Keep vulnerabilities and private vault data out of public issues. If the private
reporting button is unavailable, use
[Obsidian's security channel](https://obsidian.md/help/resources#Report+a+security+issue)
for suspected Obsidian security issues or malicious-plugin behavior.

Private vulnerability reporting is enabled for this repository. Maintainer setup
is recorded in [RELEASE.md](docs/RELEASE.md#github-configuration).

Reports are assessed privately, with follow-up for missing information and
coordinated disclosure after a fix where practical. No response-time guarantee
or bounty is offered.
