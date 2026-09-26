#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p downloads data
for region in kanto chubu; do
  if [ ! -s "downloads/${region}.osm.pbf" ]; then
    curl -fL --retry 3 -o "downloads/${region}.osm.pbf.tmp" "https://download.geofabrik.de/asia/japan/${region}-latest.osm.pbf"
    mv "downloads/${region}.osm.pbf.tmp" "downloads/${region}.osm.pbf"
  fi
done
docker build -f Dockerfile.osm-tools -t yeodong-osm-tools:local .
docker run --rm --entrypoint osmium -v "$PWD:/maps" yeodong-osm-tools:local merge /maps/downloads/kanto.osm.pbf /maps/downloads/chubu.osm.pbf -o /maps/downloads/merged.osm.pbf --overwrite
docker run --rm --entrypoint osmium -v "$PWD:/maps" yeodong-osm-tools:local extract -b 138.3,35.0,140.3,36.1 -s complete_ways /maps/downloads/merged.osm.pbf -o /maps/data/tokyo-fuji.osm.pbf --overwrite

# Country boundaries must be complete: clipped extracts lose Japan's left-driving rule.
if [ ! -s downloads/japan-boundary.osm ]; then
  curl -fL --retry 3 -o downloads/japan-boundary.osm.tmp https://api.openstreetmap.org/api/0.6/relation/382313/full
  mv downloads/japan-boundary.osm.tmp downloads/japan-boundary.osm
fi
docker run --rm --entrypoint sh -v "$PWD:/maps" yeodong-osm-tools:local -c 'osmium cat /maps/downloads/japan-boundary.osm -o /maps/downloads/japan-boundary.osm.pbf --overwrite && valhalla_build_config --mjolnir-admin /maps/data/admins-japan.sqlite > /tmp/japan-admin.json && valhalla_build_admins --config /tmp/japan-admin.json /maps/downloads/japan-boundary.osm.pbf'
cp data/admins-japan.sqlite data/admins.sqlite
