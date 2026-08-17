import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsOfUse = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full pb-4 px-4 pt-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="font-display text-2xl font-bold mb-6">Terms of Use</h1>
      <p className="text-xs text-muted-foreground mb-6">Last updated: March 23, 2026</p>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
          <p>By using Whealth Factory, you agree to these Terms of Use. If you do not agree, please do not use the app.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">2. Account Registration</h2>
          <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">3. Subscriptions</h2>
          <p>Elite subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Payment is charged to your Apple ID account or payment method on file. You can manage and cancel subscriptions in your device's Settings → Subscriptions (iOS) or through your account settings (web).</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">4. User Conduct</h2>
          <p>You agree not to post offensive, harmful, or inappropriate content. We reserve the right to remove content and suspend accounts that violate these terms.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">5. Intellectual Property</h2>
          <p>All content, branding, and features of Whealth Factory are owned by us. You retain ownership of content you create (check-in data, posts, photos).</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">6. Limitation of Liability</h2>
          <p>Whealth Factory is provided "as is" without warranties. We are not liable for any damages arising from use of the app. The app does not provide medical or health advice.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">7. Termination</h2>
          <p>We may terminate or suspend your account at any time for violation of these terms. You may delete your account at any time from your profile settings.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">8. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the app constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="font-semibold text-foreground mb-2">9. Contact</h2>
          <p>For questions about these Terms, contact us at support@wtracker.app.</p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfUse;
