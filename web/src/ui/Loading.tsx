/** HUD de carga a pantalla completa, estilo iOS. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="overlay-loading" role="status" aria-live="polite">
      <div className="hud">
        <div className="spinner" />
        {label}
      </div>
    </div>
  )
}
