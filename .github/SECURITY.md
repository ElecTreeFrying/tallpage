# Security Policy

## Supported versions

Only the **latest published version** of Tallpage receives security fixes. Older versions
are not patched in place — a fix ships as a new Chrome Web Store release.

If you are reporting against an older version, please confirm the problem still reproduces
on the latest version first.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** A public report tells
everyone about the weakness before a fix is available.

Email **electreefrying.git@gmail.com** with:

- what the problem is, and roughly how severe you think it is
- the Tallpage version, Chrome version, operating system, and steps to reproduce
- a proof of concept that does not contain another person's private data
- whether you would like to be credited in the release notes, and under what name

You can expect an acknowledgement as soon as I can manage it — usually within a week. If
the report is confirmed, I will share the expected fix timeline and tell you when the
patched release is live. If I conclude it is not a vulnerability, I will explain why.

This is a solo-maintained project, so please be patient with response times. There is no
bug bounty.

## Scope

Tallpage processes the selected webpage on the user's device. It has no developer server,
analytics, advertising, telemetry, or remotely hosted executable code. It temporarily uses
Chrome's debugger interface only after the user requests an export, then detaches when the
operation succeeds or fails.

**In scope:**

- A crafted webpage or export that executes code with extension privileges
- Access to a tab or website other than the one the user selected
- Disclosure of page content, URLs, exported files, or extension storage to an unintended
  recipient
- A failure to detach the debugger that creates a security or privacy impact beyond the
  visible Chrome banner
- Dependency vulnerabilities that are reachable from the shipped extension

**Out of scope:**

- Vulnerabilities in Chrome or the Chrome DevTools Protocol — report those to Chromium
- Chrome's expected debugger permission warning or the banner shown during an export
- An export that looks incorrect but does not cross a security boundary — open a normal
  bug report instead
- Anything requiring an attacker to already have local code execution on the device

## Disclosure

Please give me a reasonable window to ship a fix before disclosing publicly. Once the
patched version is live, you are welcome to write about it, and I will credit you in the
release notes if you would like.
