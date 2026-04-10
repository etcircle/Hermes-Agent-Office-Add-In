# SSH Tunneling

This repo is localhost-first. If your Hermes backend runs on another machine, tunnel it.

## Recommended setup

Keep the Office add-in itself local on your laptop for sideloading and Office host compatibility. Tunnel only the Hermes API port.

Example:

```bash
ssh -N -L 8642:127.0.0.1:8642 user@your-server
```

Then keep this in `.env`:

```bash
HERMES_API_BASE_URL=http://127.0.0.1:8642
```

That way the Office add-in still talks to localhost, and the tunnel quietly forwards traffic to your remote Hermes server.

## When you also need remote static assets

You usually don't. Running the add-in UI remotely makes Office sideloading and cert trust more annoying than it needs to be.

If you insist, you can tunnel the HTTPS bridge too:

```bash
ssh -N   -L 3300:127.0.0.1:3300   -L 3445:127.0.0.1:3445   user@your-server
```

But honestly, keep the UI local unless you enjoy self-inflicted pain.

## Reverse tunnels

If you need a remote machine to hit your local bridge:

```bash
ssh -N -R 8642:127.0.0.1:8642 user@your-server
```

Use sparingly. Most of the time a simple local forward is the sane option.
