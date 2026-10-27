# Información del negocio para la IA del bot

La IA del bot (cuando está encendida) usa SOLO lo que está escrito aquí, las preguntas frecuentes de `src/faq.js`
y la lista de barcos, artículos y precios de la base de datos para contestar preguntas de los clientes.
Si algo no está, el bot le pasa el chat a una persona (a ti). Escribe en español; la IA contesta en el idioma del cliente.

## Cómo funciona la reserva

- Los clientes reservan por WhatsApp con este bot, en inglés o en español.
- Se paga con tarjeta en una página segura de pago (Stripe). Nunca se pide la tarjeta por WhatsApp.
- Pesca: se paga un anticipo en línea para apartar el barco y el resto en efectivo al capitán el día del viaje.
- Antes de cobrar, el capitán confirma que el barco está disponible. El link de pago llega por WhatsApp.
- Masajes: se paga una parte en línea y el resto en efectivo a la terapeuta. La terapeuta va a la villa y lleva todo lo necesario.
- Rentas de paddleboards y kayaks: se paga todo en línea. Se entregan en la villa y se recogen el último día.
- Se reserva desde mañana hasta 180 días después. Para el mismo día, una persona del equipo ayuda.
- El cliente puede escribir "humano" o "human" en cualquier momento para hablar con una persona.

## Preguntas frecuentes

Las preguntas frecuentes (clima, cancelaciones, niños, propinas, qué llevar, masajes, dónde remar, etc.) están en
**`src/faq.js`**, en inglés y español. El bot las contesta solo, sin IA, y la IA también las usa cuando está encendida.
Si cambias una regla (por ejemplo la de cancelación), cámbiala ahí.
