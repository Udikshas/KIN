import { EveningCard } from "@/components/landing/evening-card";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Ladder } from "@/components/landing/ladder";
import { Nav } from "@/components/landing/nav";
import { Plans } from "@/components/landing/plans";
import { Privacy } from "@/components/landing/privacy";
import { Signals } from "@/components/landing/signals";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <EveningCard />
        <HowItWorks />
        <Signals />
        <Ladder />
        <Privacy />
        <Plans />
      </main>
      <Footer />
    </>
  );
}
