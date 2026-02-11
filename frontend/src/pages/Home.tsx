import Layout from '@components/layout/Layout';
import HeroSection from '@components/home/HeroSection';
import TripForm from '@components/home/TripForm';
import FeaturesSection from '@components/home/FeaturesSection';
import HowItWorks from '@components/home/HowItWorks';
import PricingSection from '@components/home/PricingSection';
import Footer from '@components/home/Footer';
import GeneratingOverlay from '@components/ui/GeneratingOverlay';
import { useTripStore } from '@/store/tripStore';

export default function Home() {
  const { isGenerating } = useTripStore();

  return (
    <Layout showBlobs>
      <div className="px-4 sm:px-6 lg:px-8 pt-48 pb-16 sm:pt-56 sm:pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <HeroSection />
        <TripForm />
        <FeaturesSection />
        <HowItWorks />
        <PricingSection />
        <Footer />
      </div>

      {/* Generating Overlay */}
      {isGenerating && <GeneratingOverlay />}
    </Layout>
  );
}
