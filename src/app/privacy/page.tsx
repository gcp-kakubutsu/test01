
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground leading-relaxed">
          <p className="text-sm">Last Updated: {new Date().toLocaleDateString()}</p>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">1. Introduction</h2>
            <p>NukuConnect ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website (collectively, the "Service").</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">2. Information We Collect</h2>
            <p>We may collect information about you in a variety of ways. The information we may collect via the Service includes:</p>
            <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
              <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, gender, age, photographs, and interests that you voluntarily give to us when you register with the Service or when you choose to participate in various activities related to the Service.</li>
              <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Service, such as your IP address, browser type, operating system, access times, and the pages you have viewed directly before and after accessing the Service.</li>
              <li><strong>Profile Verification Data:</strong> Images and descriptions you provide for AI profile verification. These are processed for safety and authenticity analysis.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">3. Use of Your Information</h2>
            <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Service to:</p>
            <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
              <li>Create and manage your account.</li>
              <li>Match you with other users.</li>
              <li>Improve our Service and offerings.</li>
              <li>Monitor and analyze usage and trends to improve your experience with the Service.</li>
              <li>Perform AI-driven analysis on profile data for safety and verification purposes.</li>
              <li>Prevent fraudulent transactions, monitor against theft, and protect against criminal activity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">4. Disclosure of Your Information</h2>
            <p>We may share information we have collected about you in certain situations. Your information may be disclosed as follows:</p>
             <ul className="list-disc list-inside pl-4 mt-2 space-y-1">
                <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others.</li>
                <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including data analysis, AI processing, hosting services, customer service, and marketing assistance.</li>
             </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">5. Security of Your Information</h2>
            <p>We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">6. Policy for Children</h2>
            <p>We do not knowingly solicit information from or market to children under the age of 18. If you become aware of any data we have collected from children under age 18, please contact us using the contact information provided below.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-secondary-foreground mb-3">7. Contact Us</h2>
            <p>If you have questions or comments about this Privacy Policy, please contact us at: privacy@nukuconnect.example.com</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
