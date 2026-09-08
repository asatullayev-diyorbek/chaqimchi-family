/* Post-process the Expo web export for the Telegram Mini App:
 *  - load the Telegram Web App SDK in <head> (before our bundle) so
 *    window.Telegram.WebApp is ready when SessionProvider reads initData
 *  - add viewport-fit=cover + a theme-color matching the app background
 *  - paint the page background immediately to avoid a white flash
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "dist", "index.html");
let html = fs.readFileSync(file, "utf8");

if (!html.includes("telegram-web-app.js")) {
  html = html.replace(
    "<title>Spino24</title>",
    `<title>Spino24</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no" />
    <meta name="theme-color" content="#eef1fb" />
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>html,body{background:#eef1fb}</style>`,
  );
  // The duplicate default viewport tag is harmless but drop it for cleanliness.
  html = html.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />\n    ',
    "",
  );
  fs.writeFileSync(file, html);
  console.log("postbuild-web: injected Telegram SDK + viewport into dist/index.html");
} else {
  console.log("postbuild-web: already processed");
}
