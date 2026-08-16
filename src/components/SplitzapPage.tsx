import SplitzapApp from '../features/splitzap/SplitzapCloudApp';
import '../features/splitzap/splitzap.css';
import '../features/splitzap/splitzap-enhanced.css';

export default function SplitzapPage() {
  return (
    <main className="fixed inset-0 z-[100] overflow-y-auto bg-[#faf9f5]">
      <SplitzapApp />
    </main>
  );
}
