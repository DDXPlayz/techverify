import { useCallback, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { analyzeModelFile } from '../engine/pipeline/analyze'
import { runCompliance } from '../engine/rules/runRules'
import { ModelLoadError } from '../engine/loaders/loadModel'
import { sampleCarFile } from '../engine/sample/sampleCar'

export function UploadZone() {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setPhase, setProgress, setError, setModel, error } = useStore()

  const process = useCallback(
    async (file: File) => {
      setError(null)
      setPhase('analyzing')
      try {
        const model = await analyzeModelFile(file, (stage, detail) => setProgress(stage, detail))
        setProgress('rules', 'Running regulation engine')
        // Give the progress UI a beat before the synchronous rule pass
        await new Promise((r) => setTimeout(r, 0))
        const report = runCompliance(model.analysis)
        setModel(model, report)
      } catch (err) {
        console.error(err)
        if (err instanceof ModelLoadError) {
          setError({ message: err.message, suggestion: err.suggestion })
        } else {
          setError({
            message: 'The model could not be analysed.',
            suggestion:
              err instanceof Error
                ? `Details: ${err.message}. Try re-exporting the model as GLB or binary STL.`
                : 'Try re-exporting the model as GLB or binary STL.',
          })
        }
      }
    },
    [setError, setPhase, setProgress, setModel],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void process(file)
    },
    [process],
  )

  return (
    <>
      <div className="upload-header">
        <span className="upload-kicker">YOUR TURN</span>
        <h2>Now, your car.</h2>
        <p>Drop a CAD export below — analysis starts instantly, right here in your browser.</p>
      </div>

      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        aria-label="Upload a 3D model file"
      >
        <span className="scanline" aria-hidden />
        <div className="dropzone-icon">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect x="8" y="14" width="36" height="28" rx="4" stroke="#4da3ff" strokeWidth="1.6" strokeDasharray="5 4" />
            <path d="M26 34V18M20 24l6-6 6 6" stroke="#e10600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3>Drop your model here</h3>
        <p>or click to browse — geometry is validated, normalised and measured automatically</p>
        <div className="dropzone-formats">
          {['GLB', 'GLTF', 'OBJ', 'STL'].map((f) => (
            <span key={f} className="format-chip">
              {f}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".glb,.gltf,.obj,.stl"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void process(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <div className="upload-error" role="alert">
          <strong>{error.message}</strong>
          <span>{error.suggestion}</span>
        </div>
      )}

      <div className="sample-row">
        <span>No model handy?</span>
        <button className="btn-ghost" onClick={() => void process(sampleCarFile())}>
          Analyse a sample car
        </button>
      </div>

      <p className="upload-privacy">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2.5" y="6" width="9" height="6" rx="1.5" stroke="#5c5c66" strokeWidth="1.2" />
          <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="#5c5c66" strokeWidth="1.2" />
        </svg>
        100% local analysis — your model never leaves this device.
      </p>
    </>
  )
}
