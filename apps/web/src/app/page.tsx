import { Bento } from "@/components/landing/bento";
import { CallDemo } from "@/components/landing/call-demo";
import { Cta } from "@/components/landing/cta";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Languages } from "@/components/landing/languages";
import { MoreFeatures } from "@/components/landing/more-features";
import { Nav } from "@/components/landing/nav";
import { Plans } from "@/components/landing/plans";
import { Privacy } from "@/components/landing/privacy";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Languages />
        <Bento />
        <Features />
        <CallDemo />
        <MoreFeatures />
        <Privacy />
        <Plans />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
