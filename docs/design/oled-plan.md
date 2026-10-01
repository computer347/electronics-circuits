# OLED (SSD1306) — work in progress

Started 2026-10-01. Done so far: `src/oled/font.ts` (5 × 7 font, GFX metrics: 6 × 8 cell).

## Plan

1. **`src/oled/gfx.ts`**: an SSD1306 + Adafruit GFX emulator.
   - 128 × 64 buffer in SSD1306 page layout (8 pages × 128 bytes).
   - Drawing ported from GFX: drawPixel (WHITE/BLACK/INVERSE), drawLine (Bresenham, steep swap), rect / fillRect, round rects (circle helpers), drawCircle / fillCircle (midpoint, fillCircleHelper), drawTriangle / fillTriangle (scanline, C truncating division), drawBitmap.
   - Text: setTextSize, setTextColor(fg[, bg]), setCursor, print / println, wrap check before drawing, setRotation 0–3.
   - Panel state: begin() fills the buffer with the library splash and turns the panel on. Before any display() the panel shows power-up noise. display() copies the buffer to the panel RAM and takes 25 ms (I²C at 400 kHz). invertDisplay, dim, and hardware scroll (right / left / diagonal, about 20 px/s; stopscroll).
   - A wrong I²C address (0x3D) leaves the panel dark.
   - `findText(pixels, text, {inverse})` for judging.
2. **`src/oled/icons.ts`**: 16 × 16 bitmaps (heart, smile, thermometer, wifi). The sketch prints them as PROGMEM arrays.
3. **`src/coding/program.ts`**:
   - New nodes: oledBegin, oledClear, oledShow, oledTextSize, oledTextColor, oledCursor, oledPrint (text / count / seconds / millis), oledPixel, oledLine, oledRect (fill, radius), oledCircle, oledTriangle, oledIcon, oledInvert, oledDim, oledRotate, oledWrap, oledScroll, countAdd, countWrap, countSet.
   - Numeric params are a number or `count`.
   - A spec-driven NODE_INFO (params, group) for a generic node editor.
   - Replace `run()` with an incremental `Runner` (advanceTo(t)), so the bench never has to precompute. `run()` stays for tests and returns frames, printed text and runtime notes.
   - sketch() adds the includes, `Adafruit_SSD1306 display(128, 64, &Wire, -1);`, `int count`, and the bitmaps.
   - compile() warnings: no begin, no display(), black text on black, non-ASCII, off-screen, display() during a scroll, and a note that the 1 KB buffer is half the Uno's RAM.
4. **Jobs** (`src/coding/jobs.ts`), each with a `judge(p)`:
   - **oled-hello**: "Hello!". Detects splash still showing, buffer never sent, wrong address, wrong text.
   - **oled-uptime**: seconds since start. Detects no clear (digits pile up) and cursor not reset.
   - **oled-progress**: outline plus a fill driven by count, which wraps.
   - **oled-status**: inverse text on a white top bar, plus an icon.
   - **oled-sandbox**: free play, never judged.
5. **Bench**:
   - Generic NodeCard driven by the specs, and a palette grouped by type (screen groups only on OLED jobs).
   - The OLED on the mat beside the Uno, pre-wired with jumpers. Move `Jumper` to `src/wiring/Jumper.tsx`.
   - A DataTexture on the 3D panel (`Display` gets a `screen` prop; rows flipped), plus a magnified 2D preview canvas.
6. **Wiring job, wiring-oled**:
   - Netlist: OLED_NETLIST with M_GND / M_VCC / M_SCL / M_SDA, and fixed parts PANEL 250 Ω, PULL_SCL and PULL_SDA 4.7 kΩ.
   - On the Uno, the SDA/SCL pins share nets with A4/A5 (`pinNet`).
   - Generalise WiringJob to `signals[]` (net, label, wants[], explain, colour). The DHT11 keeps its messages.
   - The OLED job's sketch is an I²C scanner: "I2C device found at address 0x3C !", or "No I2C devices found". Swapped SDA/SCL get a message of their own.
7. **Tests**: GFX pixel tests (line, circle, text metrics), judges pass and fail on known programs, wiring OLED, and the sketch text.

## Then: optimisation pass

- Lazy-load screens (React.lazy per nav screen, gallery, part viewer). The bundle is currently 1.7 MB, 495 KB gzipped.
- `frameloop="demand"` where scenes are static. Cap dpr and shadows on weak devices.
- PWA manifest and service worker; deploy a static preview.
- Check at phone size.
