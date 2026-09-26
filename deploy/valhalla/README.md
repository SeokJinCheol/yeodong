# Local Valhalla

Backend endpoint: `http://localhost:8002`. Only loopback is exposed.
The official scripted Valhalla image is pinned by digest in `compose.yaml`.
Docker must be running; the container restarts automatically with Docker unless explicitly stopped.

## Verified installation

Installed 2026-09-26: Valhalla `3.9.0-0baa5c687`, Geofabrik Kanto/Chubu snapshots from 2026-09-25 (both MD5 verified).
Verified healthy status after restart, walking and driving round-trip matrices/routes, left-hand driving,
and the app's `/api/plan` with a temporary copy of the saved itinerary database.

## Map coverage

The initial map covers Tokyo and the Fuji area: longitude 138.3–140.3, latitude 35.0–36.1.
It is extracted from merged Geofabrik Kanto and Chubu OSM files. Routes outside this area are not available.
The country admin DB is built separately from complete OSM relation 382313 (Japan), preserving left-hand traffic even though routing data is cropped. Prefecture-level admin names are not included.
Data: © OpenStreetMap contributors, ODbL; source: https://download.geofabrik.de/asia/japan.html.

`data/` holds the local PBF, generated routing tiles, configuration, and supporting databases.
`downloads/` holds the source maps. Both directories are excluded from Git.
Building the graph initially takes several minutes; the API becomes ready only after that finishes.

## Commands (from the repository root)

```sh
docker compose -f deploy/valhalla/compose.yaml up -d
docker compose -f deploy/valhalla/compose.yaml ps
docker compose -f deploy/valhalla/compose.yaml logs --tail=50 -f
curl --fail http://localhost:8002/status
backend/.venv/bin/python deploy/valhalla/verify.py
docker compose -f deploy/valhalla/compose.yaml stop
docker compose -f deploy/valhalla/compose.yaml start
```

## Recreate map data on another machine

```sh
./deploy/valhalla/prepare-map.sh
docker compose -f deploy/valhalla/compose.yaml up -d
```

The preparation script reuses existing source PBFs. To update them, download both regions for the same date,
verify their published MD5 checksums, then run the preparation script while the service is stopped.
Existing graph archives are reused on restart; regenerating a changed map requires temporarily setting
`force_rebuild: "True"` and `use_tiles_ignore_pbf: "False"` in the Compose environment.
Remove the rebuild override after the build completes.

Valhalla Docker documentation: https://github.com/valhalla/valhalla/blob/master/docker/README.md
