// Standard Slippy Map tile math (OSM wiki: "Slippy map tilenames"). Used to
// render an approximate-location map from a single raw OSM tile — no maps
// SDK, no API key, and it works identically on native and web since it's
// just an <Image>.
export function tileForPoint(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const xTile = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yTile = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const x = Math.floor(xTile);
  const y = Math.floor(yTile);
  return {
    x,
    y,
    zoom,
    // Where inside that 256x256 tile the point falls, in pixels — lets a
    // marker be positioned without stitching multiple tiles together.
    pixelX: (xTile - x) * 256,
    pixelY: (yTile - y) * 256,
  };
}

export function osmTileUrl(x: number, y: number, zoom: number): string {
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}
