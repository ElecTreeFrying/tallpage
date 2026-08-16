# Tallpage Privacy Policy

Effective 16 August 2026.

Tallpage exports the webpage the user chooses as PNG, PDF, HTML, or Markdown. The
extension processes the selected page on the user's device. Tallpage has no developer
server, analytics, advertising, tracking, or sale of data.

## Data Tallpage handles

| Data                                                              | Why it is handled                                                   | Where it is kept                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Current page title and URL                                        | Identify the selected page, name the export, and show export status | In memory during export and in browser-session storage until Chrome closes                                                                |
| Current page pixels, text, DOM, styles, images, and resource URLs | Create the user-requested export                                    | In memory while the export is assembled; the completed file is saved through Chrome Downloads                                             |
| Completed PNG local file path                                     | Copy the saved PNG path when the user explicitly requests it        | Resolved while the popup or side panel is open, held only in that surface's memory, and copied to the clipboard; never stored by Tallpage |
| Latest Markdown export                                            | Render the optional Tallpage Markdown preview                       | Browser-session storage until Chrome closes                                                                                               |
| Open-after-download preference                                    | Remember the user's option                                          | Chrome local extension storage until the setting is changed or Tallpage is removed                                                        |

Tallpage does not use this data to build a profile, determine a user's interests, serve
advertising, make eligibility decisions, or provide it to data brokers.

## Network behavior

Tallpage sends no page data to Tallpage or its developer. PNG, PDF, and Markdown exports do
not require a Tallpage network service.

For an HTML export, Tallpage asks the current webpage to read its own resources so they can
be embedded in the saved file. Same-origin requests may use the credentials already held by
that website; cross-origin requests omit credentials. A cross-origin or oversized resource
that cannot be embedded keeps its original URL, so opening that HTML file may contact the
resource's original host. Following links in any export can also contact the linked site.

## Storage, retention, and deletion

Export working data is held only as long as needed to create the file. A completed PNG's
absolute path, which can include local account and folder names, is held only while the popup
or side panel is open and is copied only after the user selects a PNG path-copy action. It is
not written to extension storage. Session data is cleared when Chrome closes. The preference
remains in Chrome's extension storage until the user changes it or removes Tallpage. Downloaded
files are outside Tallpage's storage and remain until the user deletes them.

Removing Tallpage clears its extension storage. Users can delete exported files with their
operating system or Chrome's downloads interface.

## Permissions and security

Tallpage runs only after the user opens its toolbar popup and chooses an export. It uses
Chrome's debugger interface temporarily on that selected tab, then detaches after the export
succeeds or fails. Tallpage requests no persistent website host access and contains no
remotely hosted executable code.

Tallpage's use of information received from Chrome APIs complies with the Chrome Web Store
User Data Policy, including the Limited Use requirements.

## Changes and contact

Material changes to this policy will be published with an updated effective date. Privacy
questions can be sent to the support contact shown on Tallpage's Chrome Web Store listing.
