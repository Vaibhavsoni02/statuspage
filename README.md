[![Health Check](../../actions/workflows/health-check.yml/badge.svg)](../../actions/workflows/health-check.yml)

## How it works

It has no backend or database. Everything is files in the repo.

1. **`urls.cfg`** lists what to monitor, one `name=url` per line. Add your homepage, API or login URL here.
2. **[`.github/workflows/health-check.yml`](.github/workflows/health-check.yml)** is a GitHub Actions cron job that runs at minute 30 of every hour.
3. **[`health-check.sh`](health-check.sh)** runs `curl` against each URL.
   - Status codes 200, 202, 301, 302 and 307 count as `success`. Anything else is `failed`.
   - It retries up to 4 times, 5 seconds apart, before recording `failed`.
   - It appends a line like `2026-11-23 13:30, success` to `logs/<name>_report.log` and keeps the last 2000 lines.
   - It then commits and pushes the log files back to the repo.
4. **[`index.html`](index.html), [`index.js`](index.js) and [`index.css`](index.css)** are the static page. In the browser, `index.js` fetches `urls.cfg` and each log file. It averages the results per day, shows the last 30 days as colored squares, and works out an uptime percentage.
   - Green means 100% of checks passed that day.
   - Yellow means a partial outage.
   - Red means under 30% of checks passed.
   - Grey means no data.
5. **GitHub Pages** serves those static files as your public status page.

## What you need

- A GitHub account.
- A fork of the repo. This is required: the script only commits when the repo isn't `statsig-io/statuspage`, so on the original it just prints results.
- Your URLs in `urls.cfg`.
- A new title in `index.html` (the `<title>` and `<h1>`).
- GitHub Pages turned on in the repo settings, serving from the main branch.
- A runner fix: the workflow uses `runs-on: blacksmith-2vcpu-ubuntu-2404`, which is a paid third-party runner you won't have. Change it to `ubuntu-latest`.
- Actions enabled on the fork, with write permission under Settings → Actions → General → Workflow permissions. Otherwise the push fails.

## Limitations

- **Check frequency.** GitHub cron runs hourly at best, and it often runs late. Scheduled workflows on repos with no activity can be disabled after 60 days.
- **Only checks reachability.** It's a plain HTTP request from GitHub's servers. It won't catch a broken login, a blank page that returns 200, or a slow response.
- **Internal sites.** Anything behind a VPN or firewall can't be reached from GitHub's runners. For those you would run the script on your own machine or server.
- **Public logs.** Your URLs and uptime history are visible in the repo if it's public, and GitHub Pages needs a paid plan for private repos.
- **Hourly commits.** The bot adds a commit every hour. The script also sets the git author to "Vijaye Raji" (a Statsig employee). Change that in `health-check.sh` to your own name.
- **No incident management** (the README says so too).

## When you would want your own server

Only if you need checks more often than hourly, or internal URLs. Then you cron-run `bash health-check.sh` on a box that has git push access to your fork. The page itself stays on GitHub Pages.


## What I changed
- **`urls.cfg`:** it now lists redbubble, teepublic, dashary, franklywearing, articore, amplitude, mixpanel and posthog.
- **Workflow:** I switched the runner to `ubuntu-latest`, since the original used a paid runner. It now runs every 30 minutes, can also be started by hand, and has write permission so it can commit the logs.
- **`health-check.sh`:** any 2xx or 3xx response counts as up, because mixpanel returns a 308 that the old code treated as down. I also added a browser-style user agent and a 20-second timeout. Commits are now authored by `github-actions[bot]` instead of Statsig's author.
- **Page:** I removed the Statsig logo and old sample logs and set the title to "Services Status". The footer still says it's forked from Statsig's project.
- **GitHub:** I made the repo public, turned on Pages, and ran the first check by hand.

# Open-Source Status Page

We tried various Status Pages out there, and built this as a fun little hobby project to make status pages as simple as possible.

## Demo

- https://status.statsig.com

## Setup instructions

1. Fork the [template repository](https://github.com/statsig-io/statuspage/).
2. Update `urls.cfg` to include your urls.

```cfg
key1=https://example.com
key2=https://statsig.com
```

3. Update `index.html` and change the title.

```html
<title>My Status Page</title>
<h1>Services Status</h1>
```

4. Set up GitHub Pages for your repository.

![image](https://user-images.githubusercontent.com/74588208/121419015-5f4dc200-c920-11eb-9b14-a275ef5e2a19.png)

## How does it work?

This project uses GitHub actions to wake up every hour and run a shell script (`health-check.sh`). This script runs `curl` on every url in your config and appends the result of that run to a log file and commits it to the repository. This log is then pulled dynamically from `index.html` and displayed in a easily consumable fashion. You can also run that script from your own infrastructure to update the status page more often.

## What does it not do (yet)?

1. Incident management.
2. Outage duration tracking.
3. Updating status root-cause.

## Got new ideas?

Send in a PR - we'd love to integrate your ideas.

## In case...

You are looking for a developer friendly Feature flags, and A/B experimentation service for your product, check out: https://www.statsig.com

![Statsig status page](https://user-images.githubusercontent.com/74588208/146078161-778fcb99-4a59-4e39-9fc0-abef18d5ac52.png)
