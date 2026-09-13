# OpenLP Simple Remote

A really simple web controller for [OpenLP](https://openlp.org). Shows the current service as a list,
highlights the live item, and gives you two big buttons: previous and next. That's it.

Layout of a typical service (image → Bible verses → videos → …) is handled automatically: the next
button walks through slides/verses inside the current item, then rolls to the next item.

## What you get

- Service item list with a big previous/next control and a live status dot
- Fluent emoji icons per item type (image, Bible, video, song, …)
- Click any item in the list to put it live
- Optional PIN screen to protect the public URL
- Optional OpenLP username/password support
- Single Docker container, ready for Coolify

## Tech

- Plain `index.html` + vanilla `app.js` + [Tailwind CSS](https://tailwindcss.com) (compiled once by the CLI)
- [fluent-emoji-webfont](https://github.com/tetunori/fluent-emoji-webfont) for icons
- One Node.js/Express process that serves the static files and proxies to OpenLP's API
  (a proxy is required: OpenLP's Flask API does not send CORS headers, so browsers can't call it
  directly from another origin, and proxying also keeps the OpenLP password off the clients).

## OpenLP setup (one time, on the OpenLP computer)

1. OpenLP → **Settings → Configure OpenLP → Remote interface** (`Server` tab in some versions).
   Enable the remote web server, set the listener address to `0.0.0.0`, keep/note the port (default `4316`).
2. Optional: tick **Require authentication** and set a user id + password. This app supports it via `OPENLP_USERNAME` / `OPENLP_PASSWORD`.
3. Give that computer a static LAN IP (e.g. `192.168.1.50`), and pass that address to the app as `OPENLP_BASE_URL`.

> Needs OpenLP **3.x** (uses the `/api/v2` REST API).

## Run locally

```bash
npm install
npm run build:css         # compile static/input.css -> static/app.css
npm start                 # http://localhost:3000
```

## Environment variables

| Variable            | Default                | Description                                             |
| ------------------- | ---------------------- | ------------------------------------------------------- |
| `OPENLP_BASE_URL`   | `http://openlp-host:4316` | OpenLP remote API address                           |
| `OPENLP_USERNAME`   | *(empty)*              | OpenLP remote user id (if auth enabled there)           |
| `OPENLP_PASSWORD`   | *(empty)*              | OpenLP remote password                                  |
| `APP_PASSWORD`      | *(empty)*              | PIN protecting this app. **Set it before exposing publicly.** |
| `POLL_INTERVAL_MS`  | `1500`                 | How often the browser asks OpenLP for state             |
| `PORT`              | `3000`                 | Port the app listens on (Coolify sets this)            |

## Videos start paused? Install the MediaAutoStart plugin

OpenLP only auto-plays a plain video (MP4) item when that item's **Auto Start** flag is
turned on (per item, via right-click in the Service Manager). There is no global setting
for it, so videos sent live stay paused.

The optional plugin in [`openlp-plugins/mediaautostart/`](openlp-plugins/mediaautostart/)
turns that flag on for **all** media items automatically — install once on the OpenLP
computer, no per-item clicking, works from this web app too. Requires OpenLP 3.1.6+.
See its [README](openlp-plugins/mediaautostart/README.md) for setup.