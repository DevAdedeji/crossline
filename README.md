# Crossline

A browser FPS with 20 campaign missions and online free-for-all. Built with Nuxt, Vue, Babylon.js and Colyseus.

[Play Crossline](https://crossline.adedeji.xyz)

## Development

Requires Node.js 24 and pnpm 11.10.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [127.0.0.1:3000](http://127.0.0.1:3000). Campaign runs locally; online development includes a local account database. See [.env.example](.env.example) for deployment configuration.

## Checks

```sh
pnpm format        # Format with Oxfmt
pnpm lint          # Lint with Oxlint
pnpm lint:fix      # Apply safe lint fixes
pnpm format:check  # Check formatting
pnpm typecheck
pnpm test
pnpm build
```

[Campaign guide](docs/campaign.md) · [Model credits](apps/web/public/models/ATTRIBUTION.md) · [Audio credits](apps/web/public/audio/ATTRIBUTION.md) · [Texture credits](apps/web/public/textures/ATTRIBUTION.md)
