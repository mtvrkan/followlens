# FollowLens Privacy Policy

_Last updated: 2026-08-12_

## The short version

**Everything FollowLens collects stays on your device. Nothing is ever uploaded, shared, sold, or sent anywhere.** FollowLens has no servers, no analytics, no trackers, and no accounts.

## What data FollowLens handles

When you open a followers/following list on a supported platform (Instagram, GitHub) while logged into your own account, FollowLens reads the entries of that list — username, display name, avatar image, and verified status — the same entries you are looking at on screen.

This data is used for exactly one purpose: comparing scans of your own lists over time so you can see who unfollowed you, who is new, and who doesn't follow you back.

## Where the data lives

- Scans are stored in your browser's local IndexedDB storage, on your device.
- Small bookkeeping values (which account was last scanned, display labels, the expected follower counts a running scan is measured against, language/theme preference) are stored in `chrome.storage.local` / `localStorage`, on your device.
- Avatar images may be stored as inline copies (data URLs) so they still display after the platform's image links expire. They are fetched only from the platform's own image servers, from the page you already have open.

## Network activity, precisely

FollowLens has no servers of its own and never sends your data anywhere. It does make requests **to the platform you are already on**, in two ways:

1. **Reading what the page loads anyway.** As you (or Auto-Collect's scrolling) move through a list, the platform's own page requests the next batch; FollowLens only reads those responses. Avatar images are re-fetched from the platform's image servers, as described above.
2. **Paging through your own list directly** ("Faster, more complete scans" in Settings, on by default). On Instagram this asks the same list endpoint the site's own page uses, from that page, with the session you are already logged in with. On GitHub it asks GitHub's public REST API (`api.github.com`). This exists because reading only what scrolling renders was measured to miss real followers, which produces wrong "doesn't follow back" results.

Requests in the second category are the only ones FollowLens initiates on its own. They go to the platform, never to us or to any third party, and carry no data about you beyond the account name whose list you asked to scan. You can switch them off in **Settings → "Faster, more complete scans"**, leaving only category 1.

## What FollowLens never does

- No data leaves your device. The extension makes **zero requests to any server of ours** — we don't have any, and none to any third party.
- No analytics, telemetry, crash reporting, or fingerprinting.
- No reading of messages, posts, passwords, or anything beyond the follower/following lists you open.
- No sale or transfer of user data to anyone, for any purpose.

## Your controls

- **Delete one account's data:** Dashboard → select the account → "Delete Account".
- **Delete everything:** Settings → "Delete all data".
- **Export your data:** Settings → "Export all data" (a JSON file saved to your device).
- Uninstalling the extension removes all stored data.

## Permissions, in plain language

- **storage** — save your scans and preferences locally.
- **scripting** — load FollowLens's own bundled script into a platform tab that is already open but not yet connected (after a browser or extension update, for example), so you don't have to reload the page by hand. Only code shipped inside the extension is injected, and only into the two sites below.
- **activeTab** — read the address of the tab you are on, and only when you click the extension icon, so the popup can tell whether you are on a supported platform and which account's list is open.
- **Access to instagram.com, github.com** — required to read the follower/following lists you open on those sites. FollowLens runs only on these two platforms and nowhere else.

## Changes & contact

If this policy changes, the extension's store listing will link to the updated version. Questions: open an issue on the project repository.
