import Hero from './components/Hero';
import Generator from './components/Generator';
import HowItWorks from './components/HowItWorks';
import Features from './components/Features';
import FAQ from './components/FAQ';
import Footer from './components/Footer';

function App() {
  const scrollToGenerator = () => {
    const element = document.getElementById('generator');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Hero onGetStarted={scrollToGenerator} />
      <Generator />
      <HowItWorks />
      <Features />
      <FAQ />
      <Footer />
    </div>
  );
}

export default App;
