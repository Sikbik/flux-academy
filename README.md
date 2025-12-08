# Flux Deployment Academy

Learn how to deploy apps on Flux, the decentralized cloud network.

## What's This?

A tutorial site with interactive guides, a spec builder, and real-time cost estimates for deploying on Flux. Built it because the docs are scattered and I wanted something hands-on.

## Quick Start

```bash
npm install
npm run dev
```

Opens at http://127.0.0.1:42069

## Deploy to Flux

```bash
# Build and push
docker build -t yourusername/flux-academy:latest .
docker push yourusername/flux-academy:latest
```

Then go to [home.runonflux.io](https://home.runonflux.io/apps/registernewapp), import this spec:

```json
{
  "version": 8,
  "name": "fluxacademy",
  "description": "Flux Deployment Academy",
  "owner": "YOUR_ZELID",
  "instances": 3,
  "compose": [{
    "name": "academy",
    "repotag": "yourusername/flux-academy:latest",
    "ports": [42069],
    "containerPorts": [42069],
    "domains": [""],
    "environmentParameters": ["NODE_ENV=production"],
    "commands": [],
    "containerData": "/appdata",
    "cpu": 1,
    "ram": 2000,
    "hdd": 5
  }]
}
```

## What's Included

**Tutorials**
- Basic deployment (single container)
- Minecraft server with persistent storage
- Multi-component apps
- Custom domains with Cloudflare
- Shared databases

**Tools**
- Spec builder with live cost estimates
- Copy-paste ready configs

## Tech

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## Project Layout

```
app/
  getting-started/    # Setup guide
  tutorials/          # Step-by-step guides
  playground/         # Spec builder tool
  reference/          # Docs
  troubleshooting/    # Common issues
components/
  tutorial/           # Guide components
  interactive/        # Spec builder
```

## Contributing

PRs welcome. Could use more tutorials for different app types.

## Links

- [Flux](https://runonflux.io)
- [Flux Docs](https://docs.runonflux.io)
- [Discord](https://discord.gg/runonflux)

## License

MIT - See [LICENSE.md](LICENSE.md)
