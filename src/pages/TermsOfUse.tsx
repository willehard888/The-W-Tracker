import { backOr } from "@/lib/nav";
import { useNavigate } from "react-router-dom";
import PageBar from "@/components/ui/page-bar";
import { COMPANY, COMPANY_ADDRESS } from "@/lib/company";

const TermsOfUse = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <PageBar onBack={() => backOr(navigate, "/")} />

      <div className="home-rise px-4 pt-3 pb-6">
      <header className="mb-6">
        <p className="eyebrow">Last updated: September 18, 2026</p>
        <h1 className="mt-1.5 font-display font-black text-beat leading-[1.04] tracking-tight">Terms of Use</h1>
      </header>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>Whealth Factory is operated by {COMPANY.name} (business ID {COMPANY.businessId}), {COMPANY_ADDRESS} — "we" and "us" in these terms.</p>
          <p className="mt-2">By using Whealth Factory, you agree to these Terms of Use. If you do not agree, please do not use the app.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">2. Account Registration</h2>
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">3. Subscriptions</h2>
          <p>Whealth Factory Premium is an auto-renewing subscription, monthly or yearly, bought through Apple. New subscriptions start with a 14-day free trial through the App Store: the subscription renews automatically at the end of the trial, at the price shown, unless you cancel it at least 24 hours before the trial ends. The trial is available once per Apple Account.</p>
          <p className="mt-2">The price is shown in the app before you buy and varies by region. Payment is charged to your Apple Account when the free trial ends (or when you confirm a purchase without one), and the subscription renews automatically unless you cancel it at least 24 hours before the end of the current period. Manage or cancel it in Settings on your iPhone: tap your name, then Subscriptions. Refunds are handled by Apple at reportaproblem.apple.com.</p>
          <p className="mt-2">Apple's Licensed Application End User License Agreement also applies to the iOS app.</p>
          <p className="mt-2">Apple Health is optional. If you connect it, the app reads the categories you allow (sleep, workouts, steps, active energy, mindful minutes and related vitals) to score your day and inform your coach, as described in the Privacy Policy. You can disconnect it at any time in Settings on your iPhone.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">4. User Conduct</h2>
          <p>There is zero tolerance for objectionable content or abusive behavior. You agree not to post content that is offensive, harmful, harassing, or otherwise inappropriate, and not to harass or abuse other users. Photos, videos and text are screened automatically before they are published. You can report objectionable content and block abusive users from within the app; reports reach the Whealth Factory team, not other members. We review reports and act on them, typically within 24 hours, by removing violating content and ejecting the users responsible. We reserve the right to remove any content and suspend or terminate accounts that violate these terms.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">5. AI features and health content</h2>
          <p>The coach and the other AI features are optional and off until you turn them on in the app. They are automated: they can be wrong, and nothing they say is medical advice. Whealth Factory is not a medical device and does not diagnose or treat anything. Talk to a doctor before changing how you train or eat if you have a condition, are pregnant, or are unsure. If you may be in danger, contact your local emergency number.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">6. Intellectual Property</h2>
          <p>All content, branding, and features of Whealth Factory are owned by us. You retain ownership of content you create (check-in data, posts, photos).</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">7. Limitation of liability</h2>
          <p>Whealth Factory is provided "as is" without warranties. We are not liable for any damages arising from use of the app. The app does not provide medical or health advice.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">8. Termination</h2>
          <p>We may terminate or suspend your account at any time for violation of these terms. You may delete your account at any time from your profile settings.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">9. Changes to these terms</h2>
          <p>We may update these terms from time to time. Continued use of the app constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">10. Contact</h2>
          <p>Questions about these terms: <a href={`mailto:${COMPANY.email}`} className="text-foreground/85 underline">{COMPANY.email}</a>.</p>
          <p className="mt-2">{COMPANY.name}, {COMPANY_ADDRESS}. Business ID {COMPANY.businessId}.</p>
        </section>
      </div>
      </div>
    </div>
  );
};

export default TermsOfUse;
