# Flutter PWA — Integración Web Push (Servia API)

Prompt para el frontend: implementar notificaciones push en la PWA de Flutter (Android/iOS vía navegador, **no APK nativa**) usando **Web Push + VAPID**. El backend ya está listo en ServiaAPI.

---

## Contexto

- Stack: **Flutter Web como PWA** (no Firebase Cloud Messaging nativo).
- Protocolo: **Web Push** con claves **VAPID**.
- El API avisa al cliente cuando, tras una recarga/venta, su `Balance` o `creditBalance` queda **por debajo de 150**.
- La notificación **no bloquea** la transacción: si falla el push, la venta sigue OK.

---

## Dependencias Flutter

```bash
flutter pub add http
# Opcional (Flutter reciente):
flutter pub add web
```

**No** hace falta `firebase_messaging` para este flujo.

Usar el cliente HTTP que ya tengan (`dio`, `http`, etc.) con el JWT de acceso.

---

## Endpoints del API

Base: `{API_BASE}/api` (ej. `https://tu-dominio/api`).

Todos (salvo documentación) requieren:

```http
Authorization: Bearer <access_token>
```

### 1. Estado y clave pública VAPID

```http
GET /notifications/status
```

Respuesta esperada (`data` si el API envuelve respuestas):

```json
{
  "disponible": true,
  "publicKey": "BKxxxx...",
  "lowBalanceThreshold": 150
}
```

- Si `disponible === false` → no pedir permiso ni suscribirse (faltan claves en el servidor).
- `publicKey` → usarla en `PushManager.subscribe` como `applicationServerKey`.

### 2. Registrar dispositivo

```http
POST /notifications/subscription
Content-Type: application/json

{
  "endpoint": "<PushSubscription.endpoint>",
  "keys": {
    "p256dh": "<base64 url-safe>",
    "auth": "<base64 url-safe>"
  },
  "timeZone": "America/Mexico_City"
}
```

- Respuesta: **204 No Content** (o wrapper vacío según interceptor).
- Hacer **upsert**: llamar de nuevo si el navegador renueva la suscripción.

### 3. Cancelar en logout

```http
DELETE /notifications/subscription
Content-Type: application/json

{
  "endpoint": "<mismo endpoint guardado>"
}
```

### 4. Prueba (opcional, desarrollo)

```http
POST /notifications/test
```

Respuesta:

```json
{ "enviados": 1 }
```

---

## Payload que envía el servidor (Service Worker)

Al llegar el evento `push`, el cuerpo JSON es:

```json
{
  "title": "Saldo bajo — Servia",
  "body": "Tu saldo se está agotando (saldo $120.00). Umbral: $150.",
  "tag": "low-balance",
  "data": {
    "type": "low_balance",
    "url": "/",
    "balance": 120.5,
    "creditBalance": 40.0,
    "threshold": 150,
    "clientId": 1
  }
}
```

También puede llegar un test:

- `tag`: `servia-test`
- `data.type`: `test`

---

## Pasos de implementación (orden)

### Paso 1 — PWA

1. Asegurar Flutter Web como PWA (`manifest.json`, iconos, HTTPS).
2. En **iOS**, documentar al usuario: **Agregar a pantalla de inicio**; sin eso el push suele fallar.
3. En **Android Chrome**, preferible PWA instalada.

### Paso 2 — Service Worker (`web/sw.js` o equivalente)

Implementar handlers:

```js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Servia', {
      body: data.body || '',
      tag: data.tag || 'servia',
      data: data.data || {},
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
```

Registrar el SW al cargar la app (desde `web/index.html` o al boot de Flutter). Coordinar con el service worker que Flutter genera en `build/web` para no pisarlo sin estrategia clara (p. ej. SW custom que importe/extienda el de Flutter, o `flutter_service_worker.js` + push en el mismo archivo según su setup).

### Paso 3 — Tras login exitoso

1. Llamar `GET /notifications/status`.
2. Si `disponible != true` → salir.
3. Pedir permiso: `Notification.requestPermission()`; si no es `granted` → salir.
4. Obtener `ServiceWorkerRegistration` y llamar:

```js
registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(publicKey),
});
```

5. Extraer de la `PushSubscription`:
   - `endpoint`
   - `keys.p256dh` y `keys.auth` en **Base64 URL-safe** (como las entrega el navegador / `getKey`).
6. `POST /notifications/subscription` con JWT.
7. Guardar el `endpoint` en local storage para el logout.

### Paso 4 — Logout

1. `DELETE /notifications/subscription` con el `endpoint` guardado.
2. Opcional: `subscription.unsubscribe()` en el navegador.
3. Borrar el `endpoint` local.

### Paso 5 — UX sugerida

- Botón o switch “Activar avisos de saldo” en ajustes (no solo silencioso al login).
- Mensaje claro en iOS si no está instalada como PWA.
- No spamear el permiso: pedirlo en un momento con contexto.

---

## Utilidad: VAPID public key → Uint8Array

```js
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
```

En Dart, hacer lo equivalente o invocar JS vía `dart:js_interop` / `package:web`.

---

## Requisitos / restricciones

| Requisito | Detalle |
|-----------|---------|
| HTTPS | Obligatorio fuera de `localhost` |
| Auth | Siempre Bearer JWT del usuario logueado |
| Destinatario | El API notifica a **todos los dispositivos** suscritos del mismo `clientId` |
| Transacción | Independiente: fallos de push no afectan ventas/recargas |
| Umbral | Por defecto **150** (`LOW_BALANCE_THRESHOLD` en servidor) |

---

## Criterios de aceptación

- [ ] Con usuario logueado y permiso concedido, `POST /subscription` guarda el dispositivo.
- [ ] `POST /notifications/test` muestra una notificación en el dispositivo.
- [ ] Tras una recarga que deje `Balance` o `creditBalance` &lt; 150, llega push con `tag: low-balance`.
- [ ] Logout llama `DELETE /subscription`.
- [ ] Si `disponible: false`, la app no rompe; solo omite push.
- [ ] Funciona en Chrome Android (PWA) y se documenta el flujo iOS (Añadir a inicio).

---

## Fuera de alcance

- APK/IPA nativas con FCM.
- OneSignal / Firebase Messaging (salvo que más adelante migren de stack).
- Cambiar la lógica de cobro/transacciones en el backend.
