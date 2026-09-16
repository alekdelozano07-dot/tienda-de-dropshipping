#!/usr/bin/env node
// Generador de fotos de producto con OpenAI gpt-image-2 (junio 2026).
// Multiplataforma (Windows/Mac). Requiere Node 18+ (fetch/FormData nativos).
//
// Uso:
//   node generar-foto.mjs --clave clave-openai.txt --prompt "..." --salida foto.jpg
//        [--ref original1.jpg] [--ref original2.jpg]
//        [--calidad low|medium|high|auto] [--tamano 1024x1024] [--formato jpeg|png|webp]
//
// Con --ref usa /v1/images/edits (fiel al producto real); sin --ref, /v1/images/generations.
// Imprime "OK <ruta>" o "ERROR <detalle>". Código de salida 0/1.

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

const claveArchivo = arg("clave");
const prompt = arg("prompt");
const salida = arg("salida");
const refs = args("ref");
const calidad = arg("calidad", "medium");
const tamano = arg("tamano", "1024x1024");
const formato = arg("formato", "jpeg");

function fallo(msg) {
  console.error("ERROR " + msg);
  process.exit(1);
}

if (!claveArchivo || !prompt || !salida) {
  fallo("faltan argumentos obligatorios: --clave, --prompt, --salida");
}
if (!fs.existsSync(claveArchivo)) fallo("no existe el archivo de clave: " + claveArchivo);
const apiKey = fs.readFileSync(claveArchivo, "utf8").trim();
if (!apiKey.startsWith("sk-")) fallo("la clave del archivo no parece valida (debe empezar por sk-)");
for (const r of refs) if (!fs.existsSync(r)) fallo("no existe la imagen de referencia: " + r);

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

async function main() {
  let res;
  if (refs.length > 0) {
    // Edición a partir de referencias (multipart)
    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("prompt", prompt);
    form.append("quality", calidad);
    form.append("size", tamano);
    form.append("output_format", formato);
    for (const r of refs) {
      const mime = MIME[path.extname(r).toLowerCase()] || "image/jpeg";
      form.append("image[]", new Blob([fs.readFileSync(r)], { type: mime }), path.basename(r));
    }
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: form,
    });
  } else {
    // Generación desde cero (JSON)
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        quality: calidad,
        size: tamano,
        output_format: formato,
      }),
    });
  }

  let data;
  try {
    data = await res.json();
  } catch {
    fallo("respuesta no valida del servidor (HTTP " + res.status + ")");
  }

  if (!res.ok || data.error) {
    const e = data.error || {};
    const code = e.code || res.status;
    let pista = "";
    if (res.status === 401) pista = " — clave incorrecta o caducada: pedir al usuario que la vuelva a pegar";
    else if (res.status === 429 && String(code).includes("insufficient_quota")) pista = " — sin creditos: el usuario debe recargar saldo en platform.openai.com (Billing)";
    else if (res.status === 429) pista = " — limite de ritmo: esperar 30-60 s y reintentar";
    else if (res.status === 400) pista = " — revisar parametros o reformular el prompt";
    fallo((e.message || "HTTP " + res.status) + " [" + code + "]" + pista);
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) fallo("la respuesta no contiene imagen");
  fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
  fs.writeFileSync(salida, Buffer.from(b64, "base64"));
  console.log("OK " + salida);
}

main().catch((e) => fallo(e.message || String(e)));
