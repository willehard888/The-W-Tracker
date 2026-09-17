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
        <p className="eyebrow">Last updated: September 20, 2026</p>
        <h1 className="mt-1.5 font-display font-black text-beat leading-[1.04] tracking-tight">Privacy Policy</h1>
      </header>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">1. Information We Collect</h2>
          <p>We collect what you give us and what you do in the app: your email address, username and profile photo; your daily check-ins (sleep, workout, hydration, habits) and any proof photo you attach; your training programs and logged sets; your food diary entries and the meal photos you scan; your journal notes and evening reflections; your messages to the AI coach; posts, comments, reactions and direct messages you send; and, if you connect it, the Apple Health summary described in section 5.</p>
          <p className="mt-2">We also collect usage data (XP, streaks, badges, which screens you open), a device token if you turn on notifications, and crash reports.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">2. How We Use Your Information</h2>
          <p>We use your information to run the app: to calculate XP, streaks, status tiers and leaderboard rankings, to build and adapt your training and nutrition, to deliver the notifications you have asked for, to process your subscription, to answer you through the AI coach (section 5), and to keep the community safe (section 6). We do not use it for advertising and we do not sell it.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">3. Data Storage & Security</h2>
          <p>Your data is stored on Supabase infrastructure, encrypted in transit and at rest. Access is limited to what the app needs: other members can see your public profile, your posts and your leaderboard position, and nothing else. We never sell your personal data, we never use it for advertising, and we never share it with data brokers. It is shared only with the service providers named in sections 4 and 5, who process it on our behalf.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">4. Third-Party Services</h2>
          <p>We use these providers, and only for the purpose named:</p>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li><span className="text-foreground/85">Supabase</span> — the database, file storage and sign-in that the app runs on.</li>
            <li><span className="text-foreground/85">Apple</span> — Sign in with Apple, In-App Purchases and the Apple Push Notification service.</li>
            <li><span className="text-foreground/85">RevenueCat</span> — subscription status. It receives an app user id and what you bought, never your card details, which only Apple sees.</li>
            <li><span className="text-foreground/85">OpenRouter, OpenAI and Google</span> — the AI features in section 5, after you opt in.</li>
            <li><span className="text-foreground/85">Sentry</span> — crash reports, so a crash can be fixed.</li>
            <li><span className="text-foreground/85">Open Food Facts and the USDA food database</span> — food lookups. They receive the search term or barcode, never your identity.</li>
          </ul>
          <p className="mt-2">Each has its own privacy policy. Providers in the United States, including the AI providers, process data under the standard contractual clauses their terms rely on.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">5. AI features</h2>
          <p>The coach, the morning brief, the day plan, the weekly review and meal-photo logging are powered by AI models we do not run ourselves. <span className="text-foreground/85">They are off until you turn them on.</span> The first time you open the coach or scan a meal photo, the app explains this and asks; you can withdraw at any time in Profile, and the rest of the app keeps working without them.</p>
          <p className="mt-2">When they are on, we send to OpenAI and Google models, through our gateway OpenRouter: your profile basics, your recent check-ins, sleep, training and Apple Health summaries, your journal notes and reflections, the messages you write to the coach, and the meal photos you choose to scan. We ask the providers not to retain or train on these requests; under their own terms they may keep a request for a limited period to detect abuse. The answer is stored in your account (your chat history, coach memories and briefs) and is deleted with your account.</p>
          <p className="mt-2">The coach is automated. It can be wrong, and it is not medical advice.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">6. Keeping the community safe</h2>
          <p>Photos, videos and text you post are screened automatically before they are published, using the same AI providers as above. This runs for everyone: it is how we keep the app free of abusive and illegal content, and it is not optional. Reports you send reach our moderation queue and are reviewed within 24 hours.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">7. Apple Health (HealthKit)</h2>
          <p>Connecting Apple Health is optional. If you connect it, the app reads the following from HealthKit: steps, walking/running and cycling distance, flights climbed, active energy, workouts (type, duration, calories and the app that recorded them — for example Garmin Connect, Polar Flow, Oura or Strava), mindful minutes, sleep (total time and sleep stages), resting heart rate, overnight heart rate, heart-rate variability, respiratory rate, blood oxygen, and your most recent body weight, body-fat percentage and VO₂ max.</p>
          <p className="mt-2">We store only aggregates: one row per day (totals, counts, the longest workout's sport, and which apps contributed) and one row per night (sleep-stage minutes and overnight averages). Raw sample streams and workout GPS routes are never stored or transmitted. This data verifies your daily check-ins, powers the Whealth Index and the Recovery card, and gives the coach recovery context. It is never used for advertising, never sold and never shared with data brokers. It is shared only with the providers in section 4, and with the AI providers in section 5 as part of your coaching, after you opt in.</p>
          <p className="mt-2">Two optional, separately-consented writes exist: your logged meals (energy, protein, carbohydrates, fat, water, caffeine) and your finished strength sessions can be saved to Apple Health if you turn those on in the app. You can revoke any of this at any time in iOS Settings → Privacy &amp; Security → Health, and deleting your account deletes the stored aggregates.</p>
          </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">8. Subscriptions and payments</h2>
          <p>Premium subscriptions are processed through Apple's App Store. We do not store your payment card information directly. Subscription management is handled through the App Store.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">9. Your rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us. You can delete your account from your profile settings.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">10. Children's privacy</h2>
          <p>Our app is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>
        </section>

        <section>
          <h2 className="font-display font-black text-lead tracking-tight leading-tight text-foreground mb-2">11. Contact us</h2>
          <p>Questions, or a request about your data: <a href="mailto:support@whealthfactory.com" className="text-foreground/85 underline">support@whealthfactory.com</a>. We answer within one working day.</p>
        </section>
      </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
