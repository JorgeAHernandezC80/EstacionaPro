# EstacionaPro

Sitio web profesional para una **empresa de estacionamiento de carros**, con frontend y backend
separados e interconectados. Construido con **HTML semántico**, **CSS modular** y **JavaScript**
(ES modules) en el cliente, y **Node.js + Express + SQLite** en el servidor.

> Cada lenguaje vive en su propia capa y se comunica con las demás:
> `HTML (páginas) → CSS (estilos) → JS de página → JS core → API REST → Express → SQLite`.

## Características

- **Landing profesional** y responsive, con modo claro/oscuro.
- **Reserva de plazas en línea** con cotización en vivo y código de reserva único.
- **Operación en tiempo real**: registro de **entrada y salida** de vehículos, tablero de plazas
  **disponibles / ocupadas / en reparación**, y **cálculo automático del cobro** a la salida.
- **Tabla de precios** por tipo de plaza y por tipo de cliente:
  **temporal / permanente**, **con / sin membresía**.
- **Panel administrativo**: reservas, ingresos e historial de movimientos.
- **SEO completo**: metaetiquetas, Open Graph, Twitter Cards, JSON-LD (`ParkingFacility`),
  `sitemap.xml` y `robots.txt`.

## Estructura del proyecto

```
EstacionaPro/
├── index.html              # Landing
├── tarifas.html            # Tabla de precios
├── reservar.html           # Reserva online
├── operacion.html          # Tablero de operación (entrada/salida)
├── admin.html              # Panel administrativo
├── nosotros.html           # Institucional
├── contacto.html           # Contacto
├── sitemap.xml · robots.txt
├── CSS/
│   ├── base/               # variables (tokens), reset, base
│   ├── components/         # header, footer, buttons, cards, forms
│   └── pages/              # home, pages, reservar, panel
├── JS/
│   ├── core/               # config, api, theme, ui, format
│   └── pages/              # inicio, tarifas, reservar, operacion, admin, contacto, generico
├── config.js               # Config de negocio (backend)
├── pricing.js              # Motor de tarifas (algoritmo de cobro)
├── validation.js           # Validación de reservas
├── db.js                   # SQLite (reservas, plazas, movimientos)
└── server.js               # Servidor Express + API REST
```

## Puesta en marcha

Requiere **Node.js 20+**.

```bash
npm install
ADMIN_TOKEN=estaciona-admin npm start
# Abre http://localhost:3000
```

Variables de entorno:

| Variable      | Descripción                              | Por defecto        |
|---------------|------------------------------------------|--------------------|
| `PORT`        | Puerto HTTP                              | `3000`             |
| `DB_PATH`     | Ruta del archivo SQLite                  | `estacionapro.db`  |
| `ADMIN_TOKEN` | Clave de operador/administrador          | `estaciona-admin`  |

> En producción, **define siempre `ADMIN_TOKEN`**. El valor por defecto es solo para desarrollo.

Accesos de gestión (usan `ADMIN_TOKEN`):
- **Operación**: `/operacion.html`
- **Administración**: `/admin.html`

## API REST

| Método | Ruta                          | Auth | Descripción                                  |
|--------|-------------------------------|------|----------------------------------------------|
| GET    | `/api/health`                 | —    | Estado del servicio                          |
| GET    | `/api/tarifas`                | —    | Tarifas, segmentos, membresías y tabla       |
| GET    | `/api/disponibilidad?fecha=`  | —    | Plazas reservables por fecha                 |
| POST   | `/api/reservas`               | —    | Crea una reserva                             |
| GET    | `/api/plazas`                 | —    | Tablero de plazas + resumen                  |
| POST   | `/api/operacion/entrada`      | ✔   | Registra ingreso de vehículo                 |
| POST   | `/api/operacion/salida`       | ✔   | Registra salida y calcula cobro              |
| PATCH  | `/api/plazas/:id`             | ✔   | Cambia estado (disponible/reparación)        |
| GET    | `/api/movimientos`            | ✔   | Historial de movimientos                     |
| POST   | `/api/auth`                   | —    | Valida la clave y entrega el token           |
| GET    | `/api/reservas`               | ✔   | Lista reservas                               |
| PATCH  | `/api/reservas/:codigo`       | ✔   | Cambia estado de una reserva                 |
| GET    | `/api/resumen`                | ✔   | KPIs para el panel                           |

## Algoritmo de cobro

```
total = precioHora(plaza) × horasCobrables × (1 − descSegmento) × (1 − descMembresía)
```

- Las fracciones de hora se redondean hacia arriba (mínimo 1 hora).
- Los clientes **permanentes** tienen un **tope de horas cobrables por día**.
- La misma fórmula vive en el backend (`pricing.js`) y en el frontend (`JS/core/config.js`)
  para cotizar sin llamadas de red; el backend siempre recalcula y es la fuente de verdad.

## Licencia

ISC.
