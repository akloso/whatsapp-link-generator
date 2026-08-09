import SplitzapApp from '../features/splitzap/SplitzapAppEnhanced';
import '../features/splitzap/splitzap.css';

export default function SplitzapPage() {
  return (
    <main className="fixed inset-0 z-[100] overflow-y-auto bg-[#faf9f5]">
      <SplitzapApp />
    </main>
  );
}
