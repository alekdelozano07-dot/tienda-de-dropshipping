#!/usr/bin/env node
// Sube un archivo de imagen local al "destino de subida" devuelto por la orden
// stagedUploadsCreate de Shopify (paso B del flujo de fotos del producto, ver
// references/09-admin-api.md). NO usa credenciales de Shopify: la subida va al
// destino temporal con los parámetros que Shopify ya entregó.
// Multiplataforma (Windows/Mac). Requiere Node 18+ (fetch/FormData/Blob).
//
// Uso:
//   node subir-foto.mjs --destino <salida-de-staged.json> --indice 0 --foto <ruta-imagen>
//
// --destino: archivo JSON con la respuesta de `store execute` de la orden
//            staged-uploads-create.graphql (la salida de --output-file).
// --indice:  qué destino usar de la lista (0 = primero). Por defecto 0.
// --foto:    ruta del archivo de imagen local a subir.
//
// Imprime "OK <resourceUrl>" si la subida fue bien (ese resourceUrl es el que
// luego pasas a producto-crear-media.graphql). Si falla, "ERROR <detalle>".

import fs from "node:fs";
import path from "node:path";

function arg(name, def = null) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function fallo(msg) {
  console.error("ERROR " + msg);
  process.exit(1);
}

const destinoArchivo = arg("destino");
const indice = parseInt(arg("indice", "0"), 10);
const foto = arg("foto");

if (!destinoArchivo || !foto) fallo("faltan --destino y/o --foto");
if (!fs.existsSync(destinoArchivo)) fallo("no existe el archivo de destino: " + destinoArchivo);
if (!fs.existsSync(foto)) fallo("no existe la foto: " + foto);

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

function buscarTargets(obj) {
  // La salida de `store execute` puede venir como { data: { stagedUploadsCreate: {...} } }
  // o directamente como { stagedUploadsCreate: {...} }. Lo resolvemos con tolerancia.
  const raiz = obj.data || obj;
  const nodo = raiz.stagedUploadsCreate || raiz;
  const targets = nodo.stagedTargets;
  if (!Array.isArray(targets)) return null;
  return { targets, userErrors: nodo.userErrors || [] };
}

async function main() {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(destinoArchivo, "utf8"));
  } catch (e) {
    fallo("el archivo de destino no es un JSON válido: " + (e.message || e));
  }
  const res = buscarTargets(parsed);
  if (!res) fallo("no encuentro 'stagedTargets' en el archivo de destino");
  if (res.userErrors && res.userErrors.length) {
    fallo("la orden de destino devolvió errores: " + JSON.stringify(res.userErrors));
  }
  const target = res.targets[indice];
  if (!target) fallo("no hay destino en el índice " + indice);

  const form = new FormData();
  for (const p of target.parameters || []) {
    form.append(p.name, p.value);
  }
  const mime = MIME[path.extname(foto).toLowerCase()] || "image/jpeg";
  form.append("file", new Blob([fs.readFileSync(foto)], { type: mime }), path.basename(foto));

  let r;
  try {
    r = await fetch(target.url, { method: "POST", body: form });
  } catch (e) {
    fallo("fallo de red al subir al destino (" + (e.message || e) + ")");
  }
  // Los destinos de Google Cloud Storage responden 201/204 sin cuerpo útil.
  if (!(r.status >= 200 && r.status < 300)) {
    const txt = await r.text().catch(() => "");
    fallo("el destino respondió HTTP " + r.status + " " + txt.slice(0, 300));
  }
  console.log("OK " + (target.resourceUrl || "(sin resourceUrl en el destino)"));
}

main().catch((e) => fallo(e.message || String(e)));
