# RandomInspiration — Plan

Una tragaperras de ideas: tiras de la palanca, giran 4 rodillos y sale una idea de proyecto con sentido.
Modos: **Web**, **Unity**, **Videojuego** (motor libre) y **Full Random** (mezcla todos).

---

## 1. Cómo funciona una idea

Cada giro arma una frase con 4 rodillos. Cada fragmento ya trae su artículo o preposición, así la frase siempre concuerda en género sin escribir gramática:

| Rodillo | Rol | Ejemplo |
|---|---|---|
| **QUÉ** | base del proyecto | "Un roguelike de cartas" |
| **SOBRE** | tema | "sobre una panadería de madrugada" |
| **GANCHO** | giro que lo hace único | "donde cada carta jugada se quema" |
| **RETO** | restricción o tecnología | "jugable con un solo botón" |

Ejemplos por modo:
- **Web:** Una PWA de hábitos · sobre cuidar plantas · donde tus amigos ven si fallas · offline-first y sin cuentas.
- **Unity:** Una herramienta de editor · sobre diseño de niveles · que genera variantes con un clic · usando solo ScriptableObjects.
- **Videojuego:** Un roguelike de cartas · sobre una panadería de madrugada · donde cada carta jugada se quema · jugable con un solo botón.
- **Full Random:** Una extensión de navegador · sobre astronomía · que convierte tus pestañas en constelaciones · en menos de 500 líneas.

### Que las combinaciones tengan sentido: etiquetas

```json
{ "id": "g-juego-041", "t": "donde cada carta jugada se quema",
  "m": ["juego", "unity"], "tags": ["cartas"], "needs": ["cartas"], "not": [], "r": 1 }
```

- `m`: en qué modos aparece (si se omite, aparece en todos). **Regla de plataforma:** cada fragmento tiene que compartir al menos un modo con el QUÉ. Así, en Full Random, "una extensión de navegador" nunca sale "con ML-Agents".
- `tags`: lo que aporta el fragmento (`juego`, `herramienta`, `2d`, `3d`, `vr`, `movil`, `multijugador`, `infantil`, `oscuro`, `ia`…).
- `needs`: el resto de la combinación debe traer **al menos una** de estas etiquetas (si está vacío, el fragmento combina con cualquiera).
- `not`: el resto de la combinación **no puede** traer ninguna de estas.
- `r`: rareza 0–3 (común, rara, épica, legendaria). Las legendarias son las ideas más locas o ambiciosas.

La lista de etiquetas válidas sale de los propios datos: el script de verificación marca cualquier `needs`/`not` que apunte a una etiqueta que no existe (atrapa erratas).

**Reglas de escritura (concordancia):** el QUÉ lleva su artículo ("un…" / "una…"). GANCHO y RETO no pueden llevar adjetivos ni participios que concuerden con el QUÉ: no vale "hecho en 48 h", sí vale "en 48 h". Los GANCHO empiezan por "donde", "que", "con", "para"…

### Volumen de contenido (meta: más de 1000 fragmentos)

| Rodillo | Web | Unity | Juego | Compartido | Total |
|---|---|---|---|---|---|
| QUÉ | 70 | 70 | 80 | – | 220 |
| SOBRE | – | – | – | 250 | 250 |
| GANCHO | 80 | 80 | 100 | 40 | 300 |
| RETO | 80 | 80 | 80 | 20 | 260 |
| **Total** | | | | | **~1030** |

Combinaciones brutas por modo: unos 100 M. Las etiquetas filtran las que no tienen sentido; `check.js` estima cuántas válidas quedan y exige **≥ 10 000 por modo** (de sobra). Lo difícil no es llegar a 10 000, es que sean buenas, y para eso está el botón 👎 (fase 5).

- **Modo Unity:** juegos y también lo que no es juego: herramientas de editor, simulaciones, AR/VR, visualización. Los RETO usan tecnología de Unity (Cinemachine, VFX Graph, ML-Agents, DOTS, Shader Graph…).
- **Modo Videojuego:** géneros, mecánicas y restricciones de game jam sin atarse a un motor.
- **Modo Web:** SaaS, extensiones, PWAs, bots, CLIs, dashboards. Los RETO son técnicos (WebGPU, offline-first, sin backend, WebSockets…).
- **Full Random:** junta todos los fragmentos y aplica las mismas reglas. Salen cruces raros entre modos, pero siguen teniendo sentido.

### Algoritmo de giro

```
spin(modo, bloqueados):
  hasta 200 intentos:
    por cada rodillo no bloqueado:
      rareza = tirada 76/15/6/3        # se tira primero, así no depende de cuántos fragmentos haya
      fragmento = uno al azar del pool[modo][rodillo] con esa rareza
    si valid(combo): devolver combo
  si nada sirve: soltar los bloqueos y repetir
```

`engine.js` es JS puro sin DOM, así que lo usan tanto la web como `check.js` (una sola implementación de `valid()`).

---

## 2. Stack (cero dependencias)

HTML, CSS y JS con módulos ES nativos. Sin framework y sin paso de build. Se sirve como sitio estático (`npm run dev` en local con un servidor de 20 líneas en `tools/serve.js`, GitHub Pages en producción).

```
index.html        máquina + paneles (<dialog> nativo: colección, favoritos, logros)
style.css         estilo "noche dorada" (azul noche, máquina negra con filo dorado, rodillos y ticket crema)
src/engine.js     pools por modo, tirada de rareza, valid(), spin()
src/slot.js       rodillos, palanca, bloqueos, modos, tarjeta de resultado, teclado
src/fx.js         sonido (WebAudio sintetizado, sin archivos), partículas (canvas), temblor, destello, vibración
src/meta.js       estado guardado (localStorage): XP, niveles y skins, racha, giro dorado, pity, colección, logros, favoritas, historial, 👎, compartir; paneles y avisos
data/que.json  data/sobre.json  data/gancho.json  data/reto.json
tools/check.js    valida datos + estima combinaciones + reparto de rarezas
tools/serve.js    servidor estático para desarrollo
```

---

## 3. Efectos ("juice") y bucle adictivo

**Cada giro tiene que sentirse bien:**
- Palanca que se arrastra con física de resorte. También se gira con ESPACIO o tocando la pantalla.
- Rodillos: tira de fragmentos al azar con el resultado al final y `translateY` con `cubic-bezier` que se pasa un poco y rebota. Desenfoque de movimiento mientras giran rápido.
- Paran uno tras otro (de izquierda a derecha, con 300 ms entre cada uno), con un golpe seco y un tic de sonido por cada fragmento que pasa, más lento a medida que frena.
- **Anticipación:** si los 3 primeros rodillos son raros o mejores (≈ 1,4 % de los giros; 1 de cada 4 acaba en jackpot), el 4º frena despacio (+1,2 s) con brillo pulsante y un sonido de latido.
- **Rareza visible:** el color solo marca la rareza (blanco o negro, azul, violeta, dorado). El ticket legendario lleva acabado holográfico (degradado tipo foil que se inclina con el puntero; el giroscopio queda fuera porque iOS pide permiso).
- **JACKPOT** (los 4 rodillos raros o mejores, más o menos 1 de cada 300 giros): destello, temblor de pantalla, explosión y lluvia dorada, arpegio con monedas y vibración. La "cámara lenta" la pone el frenado del 4º rodillo.
- Bombillas de marquesina que corren en cadena mientras gira y destellan con el jackpot (hecho en la fase 2).
- La idea sale impresa en un ticket de papel por la ranura de la máquina (hecho en la fase 2).
- Vibración en el móvil (`navigator.vibrate`) al parar cada rodillo y en el jackpot.

**Razones para volver a girar:**
- **Bloquear rodillo (HOLD):** fijas el que te gusta y vuelves a girar el resto. Es la mecánica clave para inspirarse.
- **Colección (Ideadex):** "347 / 1032 fragmentos descubiertos", por modo y por rareza. Da ganas de completarla.
- **Racha diaria + giro dorado:** el primer giro del día garantiza un fragmento épico o mejor.
- **Pity timer:** si llevas 30 giros sin una épica, la siguiente está garantizada.
- **XP y niveles:** XP por giro, con extra según la rareza. Subir de nivel desbloquea skins de la máquina (solo cambian variables CSS, son baratas de hacer).
- **Logros (~15):** primera legendaria, 100 giros, racha de 7 días, completar una columna… Se avisan con un toast.
- **Historial** de los últimos 50 giros, con "volver" para recuperar uno que se te pasó.
- **Favoritos ⭐:** se copian como Markdown o se exportan a JSON.
- **Compartir por URL:** `#q12-s88-g7-r3` reproduce la idea exacta, sin backend.

Sin dinero real, sin vidas ni energía, sin castigos: lo que engancha es la recompensa, nunca la pérdida.

**Accesibilidad (obligatoria):** `prefers-reduced-motion` quita temblor, desenfoque y partículas. Botón de silencio que se guarda. Teclado completo (ESPACIO gira, 1–4 bloquean, F marca favorito). `aria-live` lee el resultado.

---

## 4. Fases

| # | Fase | Hecho cuando |
|---|---|---|
| 1 | **Motor + datos semilla:** `engine.js`, 4 JSON con unos 15 fragmentos por modo y rodillo, `check.js` | El check pasa sin errores de estructura y muestra el avance del contenido |
| 2 | **Máquina visual:** layout, rodillos, palanca física arrastrable, HOLD, selector de modo, ticket impreso, teclado, responsive (en móvil los rodillos van en filas) | Girar se siente bien incluso sin sonido |
| 3 | **Juice:** sonido, partículas, temblor, marcos de rareza, anticipación, jackpot, movimiento reducido, silencio | Los giros a 60 fps en un móvil medio |
| 4 | **Contenido (hecho: 1116 fragmentos):** llegar a más de 1000 fragmentos en tandas (modo × rodillo), etiquetando cada uno | `check.js` en verde, y en las muestras al azar menos del 10 % no tiene sentido (revisión manual: ~4 % tras ajustar etiquetas; el botón 👎 de la fase 5 seguirá afinándolo) |
| 5 | **Bucle de enganche (hecho):** XP, niveles, skins, racha, giro dorado, pity, colección, logros, favoritos, historial, compartir por URL, botón 👎 "no tiene sentido" (guarda la combinación y se puede exportar para corregir etiquetas) | Todo sobrevive a recargar la página |
| 6 | **Publicación:** GitHub Pages, imagen OG para compartir, Lighthouse | La URL pública funciona en móvil y en escritorio |

### `tools/check.js` (`npm run check`, sale con código 1 si falla)
- **Estructura (siempre es error):** ids únicos, `t` no vacío, `m` dentro de {web, unity, juego}, `r` entre 0 y 3, y ningún `needs`/`not` que apunte a una etiqueta inexistente.
- **Huérfanos:** a cada fragmento se le prueban 500 combinaciones al azar. Si ninguna es válida, es error.
- **Combinaciones:** 100 000 muestras por modo. Estima las válidas como proporción × total y exige ≥ 10 000 por modo, con al menos un 10 % de muestras válidas para que el giro sea instantáneo.
- **Contenido:** ≥ 1000 fragmentos en total. Mientras no se llega sale como aviso ⏳, no como error, y sirve de barra de progreso. La fase 4 está hecha cuando ya no hay avisos.
- Imprime el reparto de rarezas por giro para ajustar la tirada 76/15/6/3 (hoy da 60 / 31 / 8 / 1,3 %).

---

## 5. Riesgos

- **Combinaciones sin sentido:** se controlan con etiquetas más el ciclo del 👎. Hay que escribir fragmentos concretos que combinen bien con muchos temas.
- **Repetición tras mucho uso:** las rarezas mantienen escondido lo mejor, y el contenido se amplía editando JSON sin tocar código.
- **El desenfoque cuesta en móviles:** si baja de 60 fps, se cambia por opacidad.

**Fuera por ahora:** backend/cuentas, i18n, framework, PWA offline, botón "expandir idea con IA". Se añaden si la app crece o si quieres generar el desarrollo completo de una idea (este último necesita API key y backend).
