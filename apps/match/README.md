# Crossline match service

Run through the workspace commands in the [root README](../../README.md). This long-running authoritative server uses `packages/shared` for collision, navigation and gameplay rules.

The street-detail release adds three shared bench colliders while keeping the west rooftop access route clear. Ship server and client together whenever shared map geometry changes. Railway must rebuild for changes to this service, `packages/shared`, `packages/db`, and the workspace lockfile; a web-only rebuild cannot update server collision.
