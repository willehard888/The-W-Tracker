import { backOr } from "@/lib/nav";
import { useNavigate } from "react-router-dom";
import PageBar from "@/components/ui/page-bar";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <PageBar onBack={() => backOr(navigate, "/")} />

      <div className="home-rise px-4 pt-3 pb-6">
      <header className="mb-6">
        <p className="eyebrow">Last updated: June 8, 2026</p>
        <h1 className="mt-1.5 font-display font-black text-[27px] leading-[1.04] tracking-tight">Privacy Policy</h1>
      </header>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">1. Information We Collect</h2>
          <p>We collect information you provide directly, including your email address, username, profile photo, and daily check-in data (workout status, sleep hours, hydration, etc.). We also collect usage data such as XP earned, streaks, and badges.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">2. How We Use Your Information</h2>
          <p>We use your information to provide and improve the app, calculate XP and leaderboard rankings, deliver push notifications, process subscriptions, and personalize your experience.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">3. Data Storage & Security</h2>
          <p>Your data is stored securely using industry-standard encryption. We use secure cloud infrastructure to protect your personal information. We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">4. Third-Party Services</h2>
          <p>We use third-party services for authentication, payment processing (Apple In-App Purchases via RevenueCat), and push notifications. These services have their own privacy policies.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">5. Apple Health (HealthKit)</h2>
          <p>Connecting Apple Health is optional. If you connect it, the app reads the following from HealthKit: steps, walking/running and cycling distance, flights climbed, active energy, workouts (type, duration, calories and the app that recorded them — for example Garmin Connect, Polar Flow, Oura or Strava), mindful minutes, sleep (total time and sleep stages), resting heart rate, overnight heart rate, heart-rate variability, respiratory rate, blood oxygen, and your most recent body weight, body-fat percentage and VO₂ max.</p>
          <p className="mt-2">We store only aggregates: one row per day (totals, counts, the longest workout's sport, and which apps contributed) and one row per night (sleep-stage minutes and overnight averages). Raw sample streams and workout GPS routes are never stored or transmitted. This data verifies your daily check-ins, powers the Whealth Index and the Recovery card, and gives the coach recovery context. It is never used for advertising, never sold, and never shared with third parties.</p>
          <p className="mt-2">Two optional, separately-consented writes exist: your logged meals (energy, protein, carbohydrates, fat, water, caffeine) and your finished strength sessions can be saved to Apple Health if you turn those on in the app. You can revoke any of this at any time in iOS Settings → Privacy &amp; Security → Health, and deleting your account deletes the stored aggregates.</p>
          </section>

        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">6. Subscriptions & Payments</h2>
          <p>Premium subscriptions are processed through Apple's App Store. We do not store your payment card information directly. Subscription management is handled through the App Store.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">7. Your Rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us. You can delete your account from your profile settings.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">8. Children's Privacy</h2>
          <p>Our app is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-[17px] tracking-tight leading-tight text-foreground mb-2">9. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us at support@wtracker.app.</p>
        </section>
      </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
