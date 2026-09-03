import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full pb-4 px-4 pt-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="font-display text-2xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground mb-6">Last updated: June 8, 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. Information We Collect</h2>
          <p>We collect information you provide directly, including your email address, username, profile photo, and daily check-in data (workout status, sleep hours, hydration, etc.). We also collect usage data such as XP earned, streaks, and badges.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
          <p>We use your information to provide and improve the app, calculate XP and leaderboard rankings, deliver push notifications, process subscriptions, and personalize your experience.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">3. Data Storage & Security</h2>
          <p>Your data is stored securely using industry-standard encryption. We use secure cloud infrastructure to protect your personal information. We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">4. Third-Party Services</h2>
          <p>We use third-party services for authentication, payment processing (Apple In-App Purchases via RevenueCat), and push notifications. These services have their own privacy policies.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">5. Apple Health (HealthKit)</h2>
          <p>If you choose to connect Apple Health, the app reads your workouts, steps, and active energy from HealthKit solely to verify your daily check-ins (earning the "Verified Performer" badge). Only aggregate daily values (e.g. total steps, workout count and minutes) and a verification result are stored on our secure servers — raw HealthKit samples such as heart-rate streams or GPS workout routes are never accessed, stored, or transmitted. We never use Health data for advertising or marketing, and we never sell it or share it with third parties. Connecting Apple Health is entirely optional, and you can revoke access at any time in iOS Settings → Privacy &amp; Security → Health.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">6. Subscriptions & Payments</h2>
          <p>Premium subscriptions are processed through Apple's App Store. We do not store your payment card information directly. Subscription management is handled through the App Store.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">7. Your Rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us. You can delete your account from your profile settings.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">8. Children's Privacy</h2>
          <p>Our app is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">9. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us at support@wtracker.app.</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
