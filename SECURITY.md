# Security policy

## Supported versions

The MVP is unreleased. Security fixes currently target the latest source on the
default branch. After publication, fixes target the latest stable release;
older releases are not maintained separately. Desktop Obsidian **1.14.4 or later**
is required.

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

Private reporting must be enabled in the destination repository before public
use. This policy and the custom form do not enable it; maintainer setup is recorded
in [DEVELOPMENT.md](docs/DEVELOPMENT.md#destination-repository-setup).

Reports are assessed privately, with follow-up for missing information and
coordinated disclosure after a fix where practical. No response-time guarantee
or bounty is offered.
