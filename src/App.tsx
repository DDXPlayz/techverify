import { useStore } from './state/store'
import { Landing } from './components/Landing'
import { AnalysisView } from './components/AnalysisView'
import { ProgressOverlay } from './components/ProgressOverlay'

export default function App() {
  const phase = useStore((s) => s.phase)

  return (
    <>
      {phase === 'landing' && <Landing />}
      {phase === 'analyzing' && <ProgressOverlay />}
      {phase === 'report' && <AnalysisView />}
    </>
  )
}
