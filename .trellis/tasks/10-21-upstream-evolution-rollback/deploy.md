# Publishing and Northflank rollout

The local rollback is verified. This session has not pushed or changed the
running service. Prior push/DNS approvals applied to already completed work.
Remote publishing and production deployment require applicable authorization.

## Target and recovery reference

- Branch/repository: `metapi-evolution` in `zzdccww/metapi`.
- Build workflow: `.github/workflows/build-branch-image.yml` (Linux amd64).
- Published mutable tag: `ghcr.io/zzdccww/metapi:metapi-evolution`.
- Northflank service:
  `https://app.northflank.com/t/zzdccwws-team/project/metapi/services/metapi`.
- Public domain: `https://metapi.zzdccww.qzz.io/`.
- Previously published integrated image manifest:
  `sha256:055c468596ee85f24d39f1c233ee92e7904c067038ac98bc980036a35f68e290`.
  Prior verification matched actual running pod application files, but did not
  independently measure the pod's manifest digest. Save the actual currently
  selected image before changing the service; do not rely on the mutable tag
  retaining this manifest.

## Minimal rollout after authorization

1. Push the verified rollback/history to the target branch, without force.
2. Wait for a successful branch Linux amd64 image build; record its source SHA,
   workflow run and immutable published manifest digest.
3. Run fresh-data container smoke on that image/Node 22 runtime before rollout:
   root and deep links, root assets/cache, bookmark redirects, health, saved-token
   startup and plain/encoded management auth. Local Docker was unavailable, so
   Windows checks do not fulfill this gate.
4. Retain the currently selected image and a data backup. Deploy the new verified
   digest to the existing Northflank service, maintaining its port/data volume.
5. Verify one healthy running replica, zero unexpected restarts, HTTPS `/` serving
   the original Metapi interface, `/sites` and `/accounts`, migrated `/app/` and
   `/legacy/` bookmarks, and fetched `/assets/` scripts. Check public health and
   unauthenticated plain/encoded management routes remain denied. An authorized
   user can then confirm real navigation and editor availability without a
   destructive operation.

If Northflank auto-resolves the mutable tag on startup, verify the new build
before allowing a restart/deploy to pick it up. Retain immutable recovery
identity even when configuring deployment through a tag.

## Configuration and data

No new runtime environment variable, build runtime, schema migration, data
downgrade, DNS change, or credential rotation is needed. Keep existing effective
administrator/proxy tokens, account credential secret, database/volume, host/port,
trusted-proxy/IP policy, and notification configuration. Production still refuses
an unsafe default administrator token. Build command remains `npm run build:web
&& npm run build:server`; start command remains `node dist/server/index.js`.

The compose examples now select this project's branch image, rather than an
upstream image that could restore Evolution independently of this code. The
branch workflow produces Linux amd64; other architectures require their own
release validation and must not be inferred from this branch build.

## Recovery

If health/UI/auth validation fails, redeploy the retained previous image digest
and recheck health and protected routes. No schema reversal or credential reset
is required. Reverting the newly created local rollback commit is the source
recovery path; do not reset branch history or restore the old vulnerable locks.
Browser sessions stay on the same origin and expiry policy. Recheck page/assets
after recovery because the entry document is explicitly served with no-cache.
