# Cabo Bot — bot de WhatsApp para tours de pesca y rentas de playa

El turista escanea un QR, te escribe por WhatsApp y el bot (en inglés) le vende un tour de pesca o una renta de equipo de playa/bebé. El cliente paga en línea, el sistema confirma, avisa al capitán y manda los recordatorios solo.

## Qué hace

| Paso | Lo hace el bot |
|---|---|
| 1. Llega el cliente | QR en Airbnb, villa, taxi o Instagram → abre WhatsApp con un mensaje ya escrito que dice de dónde viene (`ref: airbnb-casa-azul`) |
| 2. Pesca | Pide fecha, número de personas y duración (4/6/8 h) → muestra **solo los barcos libres** ese día → el cliente elige |
| 3. Rentas | Pide fecha de inicio y días → muestra equipo con existencias reales → carrito → dirección de entrega |
| 4. Pago | Link de Stripe. Pesca: **anticipo del 20 %** (tu comisión), el resto en efectivo al capitán. Rentas: **100 % en línea** |
| 5. Apartado | El barco/equipo queda apartado 30 min mientras paga. Si no paga, se libera solo y se le avisa |
| 6. Confirmación | Mensaje al cliente + aviso al capitán (con cuánto cobrar en efectivo) + aviso a ti |
| 7. Recordatorios | Día anterior a las 5 PM (cliente y capitán). Rentas: aviso de entrega y de recogida. Pesca: mensaje de agradecimiento que ofrece rentas |
| 8. Casos raros | El cliente escribe `human` → el bot se calla y te reenvía la conversación |

### Comandos por WhatsApp (escríbelos al número del bot)

**Tú (OWNER_PHONE):**
- `TODAY` / `TOMORROW` — viajes, entregas y recogidas del día
- `REPLY 5216241234567 mensaje` — contestar a un cliente desde el número del bot
- `BOT 5216241234567` — devolverle la conversación al bot
- `BOOKING CB1A2B3C` — ver una reserva
- `CANCEL CB1A2B3C` — cancelar (avisa al cliente y al capitán; el reembolso lo haces en Stripe)

**Capitanes:**
- `TRIPS` — sus próximos viajes
- `BLOCK 2026-11-20` / `UNBLOCK 2026-11-20` — cerrar/abrir un día (mal tiempo, mantenimiento, viaje privado)
- `BLOCKED` — días cerrados
- Cualquier otro mensaje te llega a ti.

### Panel de administración

`https://tu-dominio.com/admin` (usuario `admin`, contraseña `ADMIN_PASSWORD`): comisión del mes, ingresos por rentas, próximas reservas, chats esperando a una persona, ventas por origen (qué QR vende más) y los **códigos QR listos para imprimir**.

Haz un QR distinto por lugar para saber cuál funciona: `https://tu-dominio.com/qr/airbnb-casa-azul`, `/qr/taxi-12`, `/qr/instagram`…

---

## 1. Probarlo en tu computadora (sin cuentas, 2 minutos)

Necesitas [Node.js 22.9 o más nuevo](https://nodejs.org). No hay que instalar paquetes.

```bash
cd cabo-bot
npm run seed      # carga capitanes, barcos y equipo de ejemplo
npm start
```

Abre **http://localhost:3000/dev/chat** y escribe `hi`. Puedes hacer una reserva completa; el link de pago abre una página de pago falsa. Cambia el número de arriba por el de un capitán de ejemplo (`5216241000001`) para probar sus comandos.

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

   > `Update from Cabo Fish & Beach: {{1}}`

   y pon su nombre en `WHATSAPP_NOTIFY_TEMPLATE`. El bot la usa automáticamente para esos avisos.

## 4. Conectar pagos (Stripe)

1. Crea tu cuenta en [stripe.com](https://stripe.com) (acepta cuentas de México).
2. Copia la clave secreta en `STRIPE_SECRET_KEY`.
3. En **Developers → Webhooks** agrega `https://tu-dominio.com/stripe/webhook` con el evento `checkout.session.completed` y copia el *signing secret* en `STRIPE_WEBHOOK_SECRET`.

## 5. Publicarlo en internet

El bot es un servidor que debe estar encendido siempre (por los recordatorios) y guarda los datos en un archivo SQLite, así que necesita un hosting con **disco persistente**: [Railway](https://railway.app) o [Render](https://render.com) (con un *Disk* montado), o cualquier VPS.

- Comando de inicio: `npm start` (carpeta `cabo-bot`)
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
| `RENTAL_DELIVERY_FEE` | 25 | Cargo fijo de entrega y recogida (USD) |

Otras reglas fijas del código: reservas desde mañana hasta 180 días; el mismo día se pasa a una persona. Un barco hace un viaje por día. Salidas: 4 h y 6 h a las 7:00 AM, 8 h a las 6:00 AM (`src/dates.js`).

Si alguien paga después de que venció su apartado y el barco ya lo tomó otro, el sistema no lo confirma: le avisa al cliente y a ti te dice que hagas el reembolso.

## Estructura

```
src/server.js     servidor: webhooks de WhatsApp y Stripe, QR, admin, simulador
src/bot.js        la conversación con el turista (en inglés)
src/bookings.js   disponibilidad, apartados, pagos
src/staff.js      comandos del dueño y de los capitanes
src/notify.js     mensajes de confirmación y recordatorios
src/scheduler.js  tareas cada minuto (vencer apartados, recordatorios)
src/whatsapp.js   envío/recepción de WhatsApp Cloud API
src/payments.js   Stripe Checkout
src/pages.js      panel de admin y simulador
scripts/seed.js   tus capitanes, barcos y equipo
```
