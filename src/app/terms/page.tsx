
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <FileText className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
          <p className="text-sm">Last Updated: {new Date().toLocaleDateString()}</p>
          
          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using NukuConnect (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, do not use the Service. We may modify these Terms at any time, and such modification shall be effective upon posting on the Service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">2. Eligibility</h2>
            <p>You must be at least 18 years old to use the Service. By using the Service, you represent and warrant that you meet this age requirement.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">3. User Conduct</h2>
            <p>You are solely responsible for your conduct and any data, text, information, usernames, graphics, images, photos, profiles, audio and video clips, links ("Content") that you submit, post, and display on the Service. You agree not to misuse the Service or help anyone else to do so.</p>
            <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
              <li>You will not post Nudity or sexually explicit content.</li>
              <li>You will not harass, abuse, or intimidate other users.</li>
              <li>You will not use the Service for any illegal or unauthorized purpose.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">4. AI Verification</h2>
            <p>Our AI Profile Verification tool is designed to enhance safety but is not foolproof. NukuConnect is not liable for the accuracy of AI-driven assessments. Users should always exercise caution.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">5. Termination</h2>
            <p>We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.</p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">6. Disclaimer of Warranties</h2>
            <p>The Service is provided on an "AS IS" and "AS AVAILABLE" basis. NukuConnect makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">7. Governing Law</h2>
            <p>These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.</p>
          </section>

          <p className="mt-8 text-center font-semibold">Please read these terms carefully. Your use of NukuConnect constitutes your agreement to these Terms of Service.</p>
        </CardContent>
      </Card>
    </div>
  );
}
