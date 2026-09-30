/**
 * Every part and board in the game, as data: what it's called, its family and package, its
 * pins, and what the notebook says about it. The 3D model is found by `model` (see
 * src/parts3d/registry.tsx). Parts Lab test levels are generated from this list.
 */

export type Family = 'passive' | 'semiconductor' | 'power' | 'smd' | 'board' | 'module';

export interface CatalogueEntry {
  id: string;
  name: string;
  family: Family;
  /** Package or form: "axial", "TO-92", "0603", "board"… */
  package: string;
  /** Pins, in order, as the datasheet names them. */
  pins: string[];
  /** One line: what it does. */
  job: string;
  /** Notebook callouts. */
  facts: { label: string; text: string }[];
  /** Key in the model registry. */
  model: string;
}

export const CATALOGUE: CatalogueEntry[] = [
  // ---- through-hole passives
  { id: 'resistor', name: 'Resistor', family: 'passive', package: 'axial, ¼ W', pins: ['1', '2'], model: 'resistor',
    job: 'Limits current and drops voltage; its value is in its colour bands.',
    facts: [{ label: 'Bands', text: 'two digits, a multiplier, then tolerance (gold ±5 %)' }, { label: 'No polarity', text: 'either way round works' }, { label: '¼ W', text: 'past a quarter watt it overheats' }] },
  { id: 'ceramic-cap', name: 'Ceramic capacitor', family: 'passive', package: 'disc', pins: ['1', '2'], model: 'ceramic-cap',
    job: 'A small capacitor for smoothing and decoupling; "104" means 10 × 10⁴ pF = 100 nF.',
    facts: [{ label: '104', text: '100 nF: two digits and a count of zeros, in pF' }, { label: 'No polarity', text: 'either way round' }] },
  { id: 'electrolytic', name: 'Electrolytic capacitor', family: 'passive', package: 'radial can', pins: ['+', '−'], model: 'electrolytic',
    job: 'A big capacitor that stores charge; it has a + and a − leg.',
    facts: [{ label: 'Stripe', text: 'marks the − leg' }, { label: 'Voltage', text: 'printed rating: never exceed it' }, { label: 'Backwards', text: 'it can bulge and vent' }] },
  { id: 'led', name: 'LED (5 mm)', family: 'passive', package: 'T-1¾', pins: ['anode', 'cathode'], model: 'led',
    job: 'Lights when current flows from the long leg to the short one.',
    facts: [{ label: 'Long leg', text: 'anode (+)' }, { label: 'Flat side', text: 'cathode (−)' }, { label: 'Resistor', text: 'always needs one to limit current' }] },
  { id: 'diode-1n4148', name: 'Signal diode 1N4148', family: 'semiconductor', package: 'DO-35 glass', pins: ['anode', 'cathode'], model: 'diode-1n4148',
    job: 'A one-way valve for small currents; about 0.7 V across it when it conducts.',
    facts: [{ label: 'Black band', text: 'the cathode end' }, { label: '0.7 V', text: 'forward drop of silicon' }] },
  { id: 'diode-1n4007', name: 'Rectifier diode 1N4007', family: 'semiconductor', package: 'DO-41', pins: ['anode', 'cathode'], model: 'diode-1n4007',
    job: 'A one-way valve for power: rectifiers, reverse-polarity protection, flyback.',
    facts: [{ label: 'Silver band', text: 'the cathode end' }, { label: '1 A, 1000 V', text: 'its ratings' }] },
  { id: 'potentiometer', name: 'Potentiometer', family: 'passive', package: 'panel, 3 legs', pins: ['1', 'wiper', '3'], model: 'potentiometer',
    job: 'A resistor with a sliding tap: turning it makes an adjustable divider.',
    facts: [{ label: 'Outer legs', text: 'the full resistance, end to end' }, { label: 'Middle leg', text: 'the wiper: its voltage follows the knob' }] },
  { id: 'tactile-button', name: 'Push button', family: 'passive', package: '6 × 6 mm, 4 legs', pins: ['1', '2', '3', '4'], model: 'tactile-button',
    job: 'A switch you hold. Its legs are joined in pairs inside; pressing joins the pairs.',
    facts: [{ label: 'Pairs', text: 'legs on the same side are always joined' }, { label: 'Pressed', text: 'joins one pair to the other' }] },
  { id: 'slide-switch', name: 'Slide switch', family: 'passive', package: 'SPDT', pins: ['A', 'common', 'B'], model: 'slide-switch',
    job: 'Stays where you put it: the middle leg joins one side or the other.',
    facts: [{ label: 'Common', text: 'the middle leg' }, { label: 'SPDT', text: 'single pole, double throw' }] },
  { id: 'cell-aa', name: 'AA cell', family: 'power', package: 'AA', pins: ['+', '−'], model: 'cell-aa',
    job: 'A 1.5 V chemical cell; cells in series add up.',
    facts: [{ label: '+ end', text: 'the bump' }, { label: '1.5 V', text: 'when new' }] },
  { id: 'battery-9v', name: '9 V battery', family: 'power', package: 'PP3', pins: ['+', '−'], model: 'battery-9v',
    job: 'Six small cells in one box: 9 V from a snap connector.',
    facts: [{ label: 'Small terminal', text: 'the + (round)' }, { label: 'Big terminal', text: 'the − (hexagonal)' }] },
  { id: 'buzzer', name: 'Piezo buzzer', family: 'passive', package: '12 mm', pins: ['+', '−'], model: 'buzzer',
    job: 'Makes a sound when driven; an active buzzer beeps on DC.',
    facts: [{ label: '+', text: 'marked on top, the longer leg' }] },
  // ---- transistors and power
  { id: 'npn-bc547', name: 'NPN transistor BC547', family: 'semiconductor', package: 'TO-92', pins: ['E', 'B', 'C'], model: 'npn-bc547',
    job: 'A small current into the base switches a bigger current from collector to emitter.',
    facts: [{ label: 'E B C', text: 'left to right, flat face towards you' }, { label: 'Vbe 0.7 V', text: 'the base needs about 0.7 V to turn on' }, { label: 'Gain', text: 'collector current is about 100 × base current' }] },
  { id: 'mosfet-irlz44n', name: 'MOSFET IRLZ44N', family: 'semiconductor', package: 'TO-220', pins: ['G', 'D', 'S'], model: 'mosfet-irlz44n',
    job: 'A voltage on the gate switches a big current from drain to source; logic level, so 5 V turns it fully on.',
    facts: [{ label: 'G D S', text: 'left to right, printed face towards you' }, { label: 'Threshold', text: 'about 2 V on the gate starts it' }, { label: 'Tab', text: 'is the drain' }] },
  { id: 'reg-7805', name: 'Regulator LM7805', family: 'power', package: 'TO-220', pins: ['IN', 'GND', 'OUT'], model: 'reg-7805',
    job: 'Turns 7–35 V into a steady 5 V, burning the difference as heat.',
    facts: [{ label: 'IN GND OUT', text: 'left to right' }, { label: 'Dropout', text: 'needs about 2 V more in than out' }] },
  { id: 'ldo-ams1117', name: 'LDO AMS1117-3.3', family: 'power', package: 'SOT-223', pins: ['GND', 'OUT', 'IN'], model: 'ldo-ams1117',
    job: 'Makes 3.3 V from 5 V for ESP32 and STM32 boards.',
    facts: [{ label: 'Tab', text: 'is OUT' }, { label: '3.3 V', text: 'the rail for 3.3 V chips' }] },
  // ---- surface mount
  { id: 'chip-r-0402', name: 'Resistor 0402', family: 'smd', package: '0402 (1.0 × 0.5 mm)', pins: ['1', '2'], model: 'chip-r-0402',
    job: 'The tiniest common resistor: too small to print its value on.', facts: [{ label: '0402', text: '1.0 × 0.5 mm, in hundredths of an inch' }] },
  { id: 'chip-r-0603', name: 'Resistor 0603', family: 'smd', package: '0603 (1.6 × 0.8 mm)', pins: ['1', '2'], model: 'chip-r-0603',
    job: 'A chip resistor; "102" means 10 followed by 2 zeros: 1 kΩ.', facts: [{ label: '102', text: '1 kΩ' }, { label: '103', text: '10 kΩ' }] },
  { id: 'chip-r-0805', name: 'Resistor 0805', family: 'smd', package: '0805 (2.0 × 1.25 mm)', pins: ['1', '2'], model: 'chip-r-0805',
    job: 'A slightly bigger chip resistor, easy to solder by hand.', facts: [{ label: '0805', text: '2.0 × 1.25 mm' }] },
  { id: 'chip-c-0603', name: 'Capacitor 0603', family: 'smd', package: '0603', pins: ['1', '2'], model: 'chip-c-0603',
    job: 'A chip capacitor, usually 100 nF right next to a chip\'s power pin.', facts: [{ label: 'Unmarked', text: 'you measure it, you can\'t read it' }] },
  { id: 'chip-led-0603', name: 'LED 0603', family: 'smd', package: '0603', pins: ['anode', 'cathode'], model: 'chip-led-0603',
    job: 'A tiny board LED: power, TX/RX, pin 13.', facts: [{ label: 'Green mark', text: 'often the cathode side' }] },
  { id: 'sot23', name: 'SOT-23 transistor', family: 'smd', package: 'SOT-23', pins: ['1', '2', '3'], model: 'sot23',
    job: 'A small transistor or MOSFET in a three-legged chip package.', facts: [{ label: 'Marking', text: 'a short code, looked up in a table' }] },
  { id: 'soic8', name: 'SOIC-8 chip', family: 'smd', package: 'SOIC-8', pins: ['1', '2', '3', '4', '5', '6', '7', '8'], model: 'soic8',
    job: 'An 8-pin chip (flash memory, op-amp, driver).', facts: [{ label: 'Dot', text: 'pin 1; count anticlockwise from it' }] },
  { id: 'qfp32', name: 'QFP-32 chip', family: 'smd', package: 'TQFP-32', pins: [], model: 'qfp32',
    job: 'A chip with legs on all four sides, like the Uno\'s ATmega328P.', facts: [{ label: 'Dot', text: 'pin 1 corner' }] },
  { id: 'qfp48', name: 'QFP-48 chip', family: 'smd', package: 'LQFP-48', pins: [], model: 'qfp48',
    job: 'A bigger microcontroller package, like the Blue Pill\'s STM32.', facts: [{ label: '48 pins', text: '12 on each side' }] },
  { id: 'crystal', name: 'Crystal', family: 'smd', package: 'HC-49', pins: ['1', '2'], model: 'crystal',
    job: 'A quartz clock: it keeps a microcontroller\'s time.', facts: [{ label: '16.000', text: 'MHz, printed on top' }] },
  { id: 'usb-b', name: 'USB-B socket', family: 'smd', package: 'through-hole', pins: ['VBUS', 'D−', 'D+', 'GND'], model: 'usb-b',
    job: 'The Uno\'s USB socket: power and data.', facts: [{ label: 'VBUS', text: '5 V from the computer' }] },
  { id: 'micro-usb', name: 'Micro-USB socket', family: 'smd', package: 'SMD', pins: ['VBUS', 'D−', 'D+', 'ID', 'GND'], model: 'micro-usb',
    job: 'The small USB socket on ESP32 and STM32 boards.', facts: [{ label: '5 V', text: 'VBUS powers the board' }] },
  { id: 'dc-jack', name: 'DC barrel jack', family: 'smd', package: '5.5 / 2.1 mm', pins: ['tip', 'sleeve'], model: 'dc-jack',
    job: 'Power input: centre pin positive on the Uno, 7–12 V.', facts: [{ label: 'Centre', text: 'positive' }] },
  { id: 'header', name: 'Pin header', family: 'smd', package: '2.54 mm pitch', pins: [], model: 'header',
    job: 'Rows of pins to plug wires or boards onto.', facts: [{ label: '2.54 mm', text: '0.1 inch, the breadboard pitch' }] },
  // ---- boards and modules
  { id: 'arduino-uno', name: 'Arduino Uno', family: 'board', package: 'board', pins: ['D0–D13', 'A0–A5', '5V', '3.3V', 'GND', 'VIN'], model: 'board:arduino-uno',
    job: 'An ATmega328P on a board with USB, a 5 V regulator and headers: the classic first microcontroller.',
    facts: [{ label: '5 V logic', text: 'pins go 0 or 5 V' }, { label: 'Pin 13', text: 'has its own LED (L)' }, { label: 'VIN', text: '7–12 V in through the jack' }] },
  { id: 'esp32-devkit', name: 'ESP32 DevKit', family: 'board', package: 'board', pins: ['GPIO', '3V3', 'GND', 'VIN'], model: 'board:esp32-devkit',
    job: 'A dual-core microcontroller with Wi-Fi and Bluetooth, on a board you can breadboard.',
    facts: [{ label: '3.3 V logic', text: '5 V on a pin can damage it' }, { label: 'EN / BOOT', text: 'reset, and hold BOOT to flash' }] },
  { id: 'esp-01', name: 'ESP-01 (ESP8266)', family: 'module', package: 'module', pins: ['GND', 'IO2', 'IO0', 'RX', 'TX', 'EN', 'RST', '3V3'], model: 'board:esp-01',
    job: 'A tiny Wi-Fi module with 2 spare pins.', facts: [{ label: '3.3 V only', text: 'and it draws current spikes when it transmits' }] },
  { id: 'blue-pill', name: 'STM32 Blue Pill', family: 'board', package: 'board', pins: ['PA0–PA15', 'PB0–PB15', 'PC13', '3.3', '5V', 'G'], model: 'board:blue-pill',
    job: 'An ARM Cortex-M3 (STM32F103) at 72 MHz on a cheap breadboardable board.',
    facts: [{ label: 'BOOT0', text: 'jumper selects flashing mode' }, { label: 'PC13', text: 'has the green LED (on when LOW)' }] },
  { id: 'rc522', name: 'RFID reader RC522', family: 'module', package: 'module', pins: ['SDA', 'SCK', 'MOSI', 'MISO', 'IRQ', 'GND', 'RST', '3.3V'], model: 'board:rc522',
    job: 'Reads 13.56 MHz cards and tags over SPI.', facts: [{ label: 'Coil', text: 'the printed loop is the antenna' }, { label: '3.3 V', text: 'supply' }] },
  { id: 'oled-096', name: '0.96" OLED', family: 'module', package: 'module', pins: ['GND', 'VCC', 'SCL', 'SDA'], model: 'board:oled-096',
    job: 'A 128 × 64 pixel display on I²C.', facts: [{ label: 'I²C', text: 'two wires: SCL clock and SDA data' }] },
  { id: 'dht11', name: 'DHT11 sensor', family: 'module', package: 'module', pins: ['+', 'OUT', '−'], model: 'board:dht11',
    job: 'Temperature and humidity over one data wire.', facts: [{ label: 'OUT', text: 'the one-wire data pin, with a pull-up' }] },
  { id: 'hc-sr04', name: 'HC-SR04 ultrasonic', family: 'module', package: 'module', pins: ['Vcc', 'Trig', 'Echo', 'Gnd'], model: 'board:hc-sr04',
    job: 'Measures distance by timing an echo: Trig sends a ping, Echo stays high for the round trip.',
    facts: [{ label: 'Echo', text: '5 V out: divide it down for 3.3 V boards' }] },
  { id: 'usb-stick', name: 'USB stick', family: 'module', package: 'module', pins: ['VBUS', 'D−', 'D+', 'GND'], model: 'board:usb-stick',
    job: 'A flash controller and a NAND chip behind a USB-A plug.', facts: [{ label: 'Controller', text: 'talks USB, manages the flash' }] },
];

export const partById = (id: string) => CATALOGUE.find((p) => p.id === id);
