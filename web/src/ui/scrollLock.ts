// Bloqueo del scroll táctil de iOS mientras se arrastra o dibuja.
// Safari ignora `touch-action` en algunos casos; un `touchmove` no pasivo con
// preventDefault() es lo único fiable. Un solo listener global para toda la app.
let locked = false
let installed = false

export function setScrollLocked(value: boolean): void {
  locked = value
  if (!installed) {
    document.addEventListener('touchmove', (e) => locked && e.preventDefault(), { passive: false })
    installed = true
  }
}
