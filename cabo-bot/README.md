# Cabo Bot — bot de WhatsApp para tours de pesca, masajes y rentas de paddleboard/kayak

El turista escanea un QR, te escribe por WhatsApp y el bot (en inglés o español) le vende un tour de pesca, un masaje en su villa o una renta de paddleboard/kayak. El cliente paga en línea, el sistema confirma, avisa al capitán y manda los recordatorios solo.

## Qué hace

| Paso | Lo hace el bot |
|---|---|
| 1. Llega el cliente | QR en Airbnb, villa, taxi o Instagram → abre WhatsApp con un mensaje ya escrito que dice de dónde viene (`ref: airbnb-casa-azul`) |
| 2. Pesca | Pide fecha, número de personas y duración (4/6/8 h) → muestra **solo los barcos libres** ese día → el cliente elige |
| 2b. Confirma el capitán | Antes de cobrar, el bot le pregunta al capitán por WhatsApp si el barco está libre (botones SÍ/NO). **SÍ** → el cliente recibe el link de pago. **NO** → ese día se cierra para ese barco y al cliente se le ofrecen otros. **No contesta en 15 min** → se le ofrecen otros barcos; si no queda ninguno, te pasa el chat a ti |
| 3. Rentas | Pide fecha de inicio y días → muestra equipo con existencias reales → carrito → dirección de entrega |
| 4. Pago | Link de Stripe. Pesca: **anticipo del 20 %** (tu comisión), el resto en efectivo al capitán. Rentas: **100 % en línea** |
| 5. Apartado | El barco/equipo queda apartado 30 min mientras paga. Si no paga, se libera solo y se le avisa |
| 6. Confirmación | Mensaje al cliente + aviso al capitán (con cuánto cobrar en efectivo) + aviso a ti |
| 7. Recordatorios | Día anterior a las 5 PM (cliente y capitán). Rentas: aviso de entrega y de recogida. Pesca: mensaje de agradecimiento que ofrece rentas |
| 8. Casos raros | El cliente escribe `human` → el bot se calla y te reenvía la conversación |

### Inglés y español

Cada persona recibe los mensajes en su idioma:

- **Turistas:** el bot detecta el idioma del primer mensaje ("hola, quiero pescar" → español; "hi" → inglés; si no se puede saber, español para números de México y si no, inglés). En cualquier momento pueden escribir `español` o `english` para cambiar, y el bot repite la pregunta en la que iban. Los recordatorios y el pago de Stripe también salen en su idioma.
- **Capitanes:** cada uno tiene su idioma (`lang` en `scripts/seed.js`, español por defecto). Pueden cambiarlo escribiendo `english` o `español`.
- **Tú:** `OWNER_LANG=es` (o `en`) en `.env`. Cuando un cliente pasa a atención personal, te dice en qué idioma habla para que le contestes en ese idioma.
- **Fechas:** se entienden en los dos idiomas ("mañana", "20 de noviembre", "Nov 20", "el viernes"). En español 3/11 es 3 de noviembre; en inglés es 11 de marzo.
- **Panel:** `/admin` sale en tu idioma; el enlace de arriba cambia a inglés (`?lang=en`).
- **QR:** `/qr/villa` abre WhatsApp con un saludo en inglés y `/qr/villa?lang=es` con uno en español.

En `scripts/seed.js` cada barco tiene `description` (inglés) y `description_es`, y cada artículo `name` y `name_es`. Todos los textos del bot están en `src/i18n.js`, por si quieres cambiar alguna frase.

### Comandos por WhatsApp (escríbelos al número del bot)

Funcionan en inglés y en español, con o sin acentos.

**Tú (OWNER_PHONE):**
- `HOY` / `MAÑANA` (`TODAY` / `TOMORROW`) — viajes, entregas y recogidas del día
- `RESPONDER 5216241234567 mensaje` (`REPLY`) — contestar a un cliente desde el número del bot
- `BOT 5216241234567` — devolverle la conversación al bot
- `RESERVA CB1A2B3C` (`BOOKING`) — ver una reserva
- `CANCELAR CB1A2B3C` (`CANCEL`) — cancelar (avisa al cliente y al capitán en su idioma; el reembolso lo haces en Stripe)

**Capitanes:**
- `SÍ CB1A2B3C` / `NO CB1A2B3C` (`YES`) — contestar una solicitud (o tocar el botón; si solo tiene una pendiente basta con `sí` o `no`)
- `VIAJES` (`TRIPS`) — sus próximos viajes
- `BLOQUEAR 2026-11-20` / `DESBLOQUEAR 2026-11-20` (`BLOCK` / `UNBLOCK`) — cerrar/abrir un día (mal tiempo, mantenimiento, viaje privado)
- `BLOQUEADOS` (`BLOCKED`) — días cerrados
- `ENGLISH` / `ESPAÑOL` — cambiar su idioma
- Cualquier otro mensaje te llega a ti.

### Panel de administración

`https://tu-dominio.com/admin` (usuario `admin`, contraseña `ADMIN_PASSWORD`): comisión del mes, ingresos por rentas, próximas reservas, chats esperando a una persona, ventas por origen (qué QR vende más) y los **códigos QR listos para imprimir**.

Haz un QR distinto por lugar para saber cuál funciona: `https://tu-dominio.com/qr/airbnb-casa-azul`, `/qr/taxi-12`, `/qr/instagram`…

---

## 1. Probarlo en tu computadora (sin cuentas, 2 minutos)

Necesitas [Node.js 22.9 o más nuevo](https://nodejs.org).

```bash
cd cabo-bot
npm install       # instala el SDK de Anthropic (para la IA)
npm run seed      # carga capitanes, barcos y equipo de ejemplo
npm start
```

Abre **http://localhost:3000/dev/chat**. Arriba hay botones para hacer cada papel: turista en inglés, turista en español, cada capitán y tú (el dueño). Cada uno tiene su propio chat, así que puedes reservar como turista, cambiarte al capitán para tocar **SÍ**, y regresar al turista para pagar. El link de pago abre una página de pago falsa. No hace falta crear el archivo `.env` para esta prueba.

Pruebas automáticas: `npm test`.

## 2. Pon tus capitanes, barcos y equipo

Edita `scripts/seed.js` (nombre, WhatsApp del capitán, precios por 4/6/8 h, capacidad, punto de encuentro, equipo y existencias) y vuelve a correr `npm run seed`. Puedes correrlo las veces que quieras: actualiza, no duplica.

Los números van en formato internacional, solo dígitos: México `521` + 10 dígitos (ej. `5216241234567`).

## 3. Conectar WhatsApp (Meta WhatsApp Cloud API)

1. Entra a [developers.facebook.com](https://developers.facebook.com) → crea una app tipo **Business** → agrega **WhatsApp**.
2. Registra tu número de negocio (debe ser un número que **no** esté usando la app normal de WhatsApp).
3. Copia a tu `.env`: `WHATSAPP_TOKEN` (token permanente de un *System User*), `WHATSAPP_PHONE_NUMBER_ID`, y el *App Secret* en `WHATSAPP_APP_SECRET`.
4. En **Webhooks**: URL `https://tu-dominio.com/webhook`, token de verificación = tu `WHATSAPP_VERIFY_TOKEN`. Suscríbete al campo `messages`.
5. **Plantilla para avisos:** WhatsApp solo deja mandar mensajes libres hasta 24 h después del último mensaje de esa persona. Los recordatorios y avisos a capitanes pueden caer fuera de esa ventana, así que crea en el *WhatsApp Manager* una plantilla (categoría *Utility*, idioma inglés) con este cuerpo:

   > `Update from Cabo Villa Concierge: {{1}}`

   Agrégale también la versión en español (mismo nombre, idioma *Spanish (MEX)*):

   > `Aviso de Cabo Villa Concierge: {{1}}`

   y pon su nombre en `WHATSAPP_NOTIFY_TEMPLATE`. El bot usa automáticamente la versión del idioma de cada persona.

## 4. Conectar pagos (Stripe)

1. Crea tu cuenta en [stripe.com](https://stripe.com) (acepta cuentas de México).
2. Copia la clave secreta en `STRIPE_SECRET_KEY`.
3. En **Developers → Webhooks** agrega `https://tu-dominio.com/stripe/webhook` con el evento `checkout.session.completed` y copia el *signing secret* en `STRIPE_WEBHOOK_SECRET`.

### ¿De dónde sale la disponibilidad?

De la base de datos del bot: un barco está libre si no tiene reservas del bot ese día, nadie lo tiene apartado y el capitán no cerró la fecha. Como el capitán también vende por fuera, **siempre se le pregunta antes de cobrar**. Cuando dice NO, ese día queda cerrado para que no se le vuelva a preguntar. Aun así conviene que los capitanes manden `BLOCK fecha` cuando venden por su cuenta: así el turista ni siquiera ve ese barco.

## 5. Activar la IA (opcional, recomendado)

Sin IA el bot entiende botones, números, fechas y palabras clave. Con IA también entiende frases normales y con faltas de ortografía ("we're 4 and want to fish next Friday"), contesta preguntas y saca de una sola frase la fecha, las personas y las horas.

1. Crea una cuenta en [platform.claude.com](https://platform.claude.com), agrega saldo y crea una API key.
2. Ponla en tu `.env`: `ANTHROPIC_API_KEY=sk-ant-...`
3. Escribe la información de tu negocio en **`knowledge.md`** (qué incluye cada barco, cancelaciones, clima, niños, propinas…). La IA contesta **solo** con eso y con los barcos, artículos y precios de la base de datos. Si algo no está ahí, te pasa el chat a ti. Puedes editarlo cuando quieras, sin reiniciar el bot.

Cómo funciona: los botones y las palabras clave siguen igual (y gratis). La IA solo se usa cuando el bot no entiende un mensaje, y nunca reserva, cobra ni confirma nada: solo le dice al bot qué quiso decir el cliente. Si la IA falla o no hay key, el bot contesta como siempre.

| Variable | Por defecto | Qué es |
|---|---|---|
| `ANTHROPIC_API_KEY` | (vacío = sin IA) | Tu clave de la API de Claude |
| `AI_MODEL` | `claude-opus-5-5` | Modelo de Claude. `claude-haiku-5-5` es mucho más barato y suele bastar para esto |
| `KNOWLEDGE_PATH` | `./knowledge.md` | Archivo con la información de tu negocio |

## 6. Publicarlo en internet

El bot es un servidor que debe estar encendido siempre (por los recordatorios) y guarda los datos en un archivo SQLite, así que necesita un hosting con **disco persistente**: [Railway](https://railway.app) o [Render](https://render.com) (con un *Disk* montado), o cualquier VPS.

- Comando de instalación: `npm install`; comando de inicio: `npm start` (carpeta `cabo-bot`)
- Variables de entorno: copia `.env.example` → `.env` y llénalo (o ponlas en el panel del hosting)
- `DB_PATH` debe apuntar al disco persistente (ej. `/data/cabo.db`)
- `PUBLIC_URL` = la URL pública que te da el hosting

Netlify/Vercel no sirven para esto (no mantienen un servidor encendido ni un disco).

---

## Reglas de negocio (en `.env`)

| Variable | Por defecto | Qué es |
|---|---|---|
| `DEPOSIT_PERCENT` | 20 | % que se cobra en línea en pesca (tu comisión) |
| `HOLD_MINUTES` | 30 | Minutos que se aparta el barco/equipo esperando el pago |
| `CAPTAIN_REPLY_MINUTES` | 15 | Minutos que tiene el capitán para contestar SÍ/NO. Entre 9 PM y 7 AM el plazo empieza a contar a las 7 AM |
| `RENTAL_DELIVERY_FEE` | 25 | Cargo fijo de entrega y recogida (USD) |
| `MASSAGE_THERAPISTS` | 1 | Terapeutas disponibles por horario de masaje (cada persona necesita uno). Con 1 el bot no pregunta cuántas personas |
| `MASSAGE_PRICE_60` | 120 | Precio por persona del masaje de 60 min (USD) |
| `MASSAGE_PRICE_90` | 170 | Precio por persona del masaje de 90 min (USD) |
| `MASSAGE_CASH_60` | 67 | Lo que el cliente paga en efectivo a la terapeuta por masaje de 60 min (USD). El resto se cobra en línea y es tu ganancia |
| `MASSAGE_CASH_90` | 95 | Lo mismo para 90 min (USD) |

Otras reglas fijas del código: reservas desde mañana hasta 180 días; el mismo día se pasa a una persona. Si no da tiempo de esperar al capitán (menos de 3 h entre el plazo de respuesta y la salida, p. ej. alguien reserva a las 11 PM para mañana a las 7 AM), el chat se te pasa a ti. Un barco hace un viaje por día. Salidas: 4 h y 6 h a las 7:00 AM, 8 h a las 6:00 AM (`src/dates.js`). Masajes: horarios 9 AM, 12 PM, 3 PM y 6 PM (`MASSAGE_TIMES` en `src/bookings.js`); el cliente paga en efectivo a la terapeuta `MASSAGE_CASH_60`/`MASSAGE_CASH_90` y el resto se cobra en línea.

Si alguien paga después de que venció su apartado y el barco ya lo tomó otro, el sistema no lo confirma: le avisa al cliente y a ti te dice que hagas el reembolso.

## Estructura

```
src/server.js     servidor: webhooks de WhatsApp y Stripe, QR, admin, simulador
src/bot.js        la conversación con el turista
src/ai.js         la IA (Claude) que entiende los mensajes que el bot no entiende
knowledge.md      la información de tu negocio que usa la IA para contestar
src/bookings.js   disponibilidad, apartados, pagos
src/staff.js      comandos del dueño y de los capitanes
src/notify.js     mensajes de confirmación y recordatorios
src/scheduler.js  tareas cada minuto (vencer apartados, recordatorios)
src/i18n.js       todos los textos en inglés y español
src/whatsapp.js   envío/recepción de WhatsApp Cloud API
src/payments.js   Stripe Checkout
src/pages.js      panel de admin y simulador
scripts/seed.js   tus capitanes, barcos y equipo
```
