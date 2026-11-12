/** HUD de carga a pantalla completa, estilo iOS. Con `onCancel`, muestra "Cancelar". */
export function Loading({ label, onCancel }: { label: string; onCancel?: () => void }) {
  return (
    <div className="overlay-loading" role="status" aria-live="polite">
      <div className="hud">
        <div className="spinner" />
        {label}
        {onCancel && (
          <button type="button" className="bar-button hud-cancel" onClick={onCancel}>Cancelar</button>
        )}
      </div>
    </div>
  )
}
