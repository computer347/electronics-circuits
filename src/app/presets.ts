/** World 0 starter circuits, used as presets on the test bench. */
export const PRESETS: Record<string, string> = {
  'LED + resistor': `* Light an LED without killing it
V1 vcc 0 9
R1 vcc a 330
LED1 a 0 red`,
  'Reversed LED': `* Something is backwards...
V1 vcc 0 9
R1 vcc a 330
LED1 0 a red`,
  'No resistor': `* What could go wrong?
V1 vcc 0 5
LED1 vcc 0 green`,
  'Voltage divider': `V1 vcc 0 9
R1 vcc out 1k
R2 out 0 2k`,
  'Series vs parallel': `V1 a 0 12
R1 a m 100
R2 m 0 200
R3 m 0 300`,
  Short: `* A wire straight across the battery
V1 a 0 9
W1 a 0
R1 a 0 1k`,
};
