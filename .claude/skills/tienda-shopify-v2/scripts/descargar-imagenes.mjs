#!/usr/bin/env node
// Descarga una lista de imágenes (URLs públicas del CDN de Shopify u otras) a
// una carpeta local. Multiplataforma (Windows/Mac). Requiere Node 18+ (fetch).
//
// Uso:
//   node descargar-imagenes.mjs --carpeta <ruta> --url <u1> [--url <u2> ...]
//   node descargar-imagenes.mjs --carpeta <ruta> --lista <archivo-con-una-url-por-linea>
//
// Numera las descargas (1, 2, 3...) conservando la extensión detectada.
// Imprime "OK <ruta>" por cada imagen, o "ERROR <detalle>" y sale con código 1.

import fs from "node:fs";
import path from "node:path";

function arg(name, def = null) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function args(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--" + name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}
function fallo(msg) {
  console.error("ERROR " + msg);
  process.exit(1);
}

const carpeta = arg("carpeta");
let urls = args("url");
const lista = arg("lista");

if (!carpeta) fallo("falta --carpeta");
if (lista) {
  if (!fs.existsSync(lista)) fallo("no existe la lista: " + lista);
  urls = urls.concat(
    fs.readFileSync(lista, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  );
}
if (urls.length === 0) fallo("no se han pasado URLs (--url o --lista)");

fs.mkdirSync(carpeta, { recursive: true });

const EXT_VALIDAS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
function extDe(url, contentType) {
  const limpia = url.split("?")[0];
  const e = path.extname(limpia).toLowerCase();
  if (EXT_VALIDAS.includes(e)) return e;
  if (contentType) {
    if (contentType.includes("jpeg")) return ".jpg";
    if (contentType.includes("png")) return ".png";
    if (contentType.includes("webp")) return ".webp";
    if (contentType.includes("gif")) return ".gif";
    if (contentType.includes("avif")) return ".avif";
  }
  return ".jpg";
}

async function main() {
  let i = 0;
  for (const url of urls) {
    i++;
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      fallo("no se pudo descargar " + url + " (" + (e.message || e) + ")");
    }
    if (!res.ok) fallo("HTTP " + res.status + " al descargar " + url);
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = extDe(url, res.headers.get("content-type") || "");
    const salida = path.join(carpeta, "producto-" + i + ext);
    fs.writeFileSync(salida, buf);
    console.log("OK " + salida);
  }
}

main().catch((e) => fallo(e.message || String(e)));
