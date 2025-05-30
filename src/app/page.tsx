
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle, ShieldCheck, Users, MessageCircle, Search, Award, PhoneOff, UserCheck, Eye, TrendingUp, Smile } from 'lucide-react';

const features = [
  {
    title: 'AI-Powered Recommendations',
    description: 'Our AI analyzes compatibility and preferences to suggest ideal partners, making your search for connection effortless.',
    icon: <TrendingUp className="h-10 w-10 text-primary mb-4" />,
    image: "https://placehold.co/300x200.png?text=AI+Match",
    dataAiHint: "AI algorithm",
  },
  {
    title: 'Post Your Desires',
    description: 'Create posts about what you\'re looking for or dates you want to go on. Increase your chances of meeting someone special.',
    icon: <MessageCircle className="h-10 w-10 text-primary mb-4" />,
    image: "https://placehold.co/300x200.png?text=Post+Desire",
    dataAiHint: "couple date",
  },
  {
    title: 'Advanced Search',
    description: 'Filter profiles by specific criteria and preferences to find exactly who you\'re looking for and make direct connections.',
    icon: <Search className="h-10 w-10 text-primary mb-4" />,
    image: "https://placehold.co/300x200.png?text=Search+Profiles",
    dataAiHint: "magnifying glass",
  },
];

const whyNukuConnect = [
  { title: 'Affordable Pricing', description: 'Competitive rates for premium features. Women use most features for free!', icon: <Smile className="h-6 w-6 text-accent" /> },
  { title: 'Complete Anonymity', description: 'Your privacy is paramount. Connect without revealing your real identity until you\'re ready.', icon: <Eye className="h-6 w-6 text-accent" /> },
  { title: 'In-App Communication', description: 'No need for external apps like LINE or Twitter. All interactions happen within NukuConnect.', icon: <MessageCircle className="h-6 w-6 text-accent" /> },
  { title: 'User Ratings', description: 'Check community feedback before you meet, ensuring safer interactions.', icon: <UserCheck className="h-6 w-6 text-accent" /> },
  { title: 'Privacy Controls', description: 'Block contacts by phone number to avoid unwanted encounters with acquaintances.', icon: <PhoneOff className="h-6 w-6 text-accent" /> },
];

const safetyFeatures = [
  { title: 'Identity Verification', description: 'Mandatory ID checks to ensure genuine profiles and user safety.', icon: <UserCheck className="h-8 w-8 text-primary" /> },
  { title: '24/7 Monitoring', description: 'Our team and AI systems monitor for suspicious activity and policy violations.', icon: <ShieldCheck className="h-8 w-8 text-primary" /> },
  { title: 'Strict User Conduct', description: 'Zero tolerance for harassment. Violators face warnings or permanent bans.', icon: <Users className="h-8 w-8 text-primary" /> },
  { title: 'Report & Block', description: 'Easily report and block users exhibiting inappropriate behavior.', icon: <CheckCircle className="h-8 w-8 text-primary" /> },
  { title: 'Nickname Registration', description: 'Use a nickname to keep your real name private. Your personal info is never shared.', icon: <Eye className="h-8 w-8 text-primary" /> },
  { title: 'Official Registration', description: 'Registered with relevant authorities to ensure legal compliance and user protection.', icon: <Award className="h-8 w-8 text-primary" /> },
];

const faqItems = [
  {
    question: 'Is NukuConnect free to use?',
    answer: 'Basic features are free for everyone. Women enjoy extended free access to most features. Men can upgrade to a premium plan for full access, starting at competitive rates.',
  },
  {
    question: 'Will my identity be revealed?',
    answer: 'NukuConnect is designed for anonymity. You can use a nickname, and your real identity is not shared. We also offer features like phone number blocking to prevent matching with people you know.',
  },
  {
    question: 'How does NukuConnect ensure safety?',
    answer: 'We employ multiple safety measures, including ID verification, 24/7 monitoring, a strict code of conduct, and easy reporting/blocking tools. Your safety is our top priority.',
  },
  {
    question: 'Who can use NukuConnect?',
    answer: 'NukuConnect is for adults aged 18 and over.',
  },
];


export default function LandingPage() {
  return (
    <div className="space-y-16 md:space-y-24">
      {/* Hero Section */}
      <section className="relative text-center py-20 md:py-32 rounded-lg overflow-hidden bg-gradient-to-br from-primary to-accent">
        <div className="absolute inset-0">
          <Image 
            src="https://placehold.co/1200x600.png?text=NukuConnect+Background"
            alt="NukuConnect Background"
            layout="fill"
            objectFit="cover"
            className="opacity-30"
            data-ai-hint="abstract romance"
          />
        </div>
        <div className="relative container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-6">
            Connect Deeply. Live Fully.
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground mb-8 max-w-2xl mx-auto">
            NukuConnect helps you find meaningful connections based on true compatibility and shared desires. Embrace a richer life.
          </p>
          <div className="space-x-4">
            <Button size="lg" asChild className="bg-background text-foreground hover:bg-background/90">
              <Link href="/signup">Join NukuConnect</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Intro Section */}
      <section className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">What is NukuConnect?</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          NukuConnect is a revolutionary platform designed for adults seeking genuine connections. We believe that a fulfilling intimate life contributes significantly to overall happiness. Our service provides a safe, easy, and respectful environment to find partners who truly understand and share your desires.
        </p>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-12">Discover Your Ideal Partner with Our Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="shadow-xl hover:shadow-2xl transition-shadow duration-300 flex flex-col">
              <CardHeader className="items-center text-center">
                {feature.icon}
                <CardTitle className="text-2xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow text-center">
                <div className="relative w-full h-40 rounded-md overflow-hidden mb-4">
                    <Image src={feature.image} alt={feature.title} layout="fill" objectFit="cover" data-ai-hint={feature.dataAiHint} />
                </div>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Why NukuConnect Section */}
       <section className="bg-secondary py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-secondary-foreground mb-12">Why Choose NukuConnect?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyNukuConnect.map((reason) => (
              <Card key={reason.title} className="bg-card shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {reason.icon}
                    <CardTitle className="text-xl text-primary">{reason.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{reason.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>


      {/* How to Register Section */}
      <section className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-12">Getting Started is Easy</h2>
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-semibold text-center text-pink-600 mb-6 p-3 bg-pink-100 rounded-lg">For Women</h3>
            <ol className="space-y-6">
              {['Profile Setup', 'Identity Verification', 'Find Your Match Securely'].map((step, index) => (
                <li key={step} className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 bg-pink-500 text-white rounded-full flex items-center justify-center font-bold text-lg mr-4">{index + 1}</div>
                  <div>
                    <h4 className="font-semibold text-lg text-pink-700">{step}</h4>
                    <p className="text-muted-foreground text-sm">
                      {index === 0 && "Quickly set up your profile with your preferences."}
                      {index === 1 && "Complete a simple verification process for safety."}
                      {index === 2 && "Start browsing profiles. Yours is hidden until you reach out!"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-center text-blue-600 mb-6 p-3 bg-blue-100 rounded-lg">For Men</h3>
            <ol className="space-y-6">
              {['Profile Setup', 'Identity Verification', 'Choose a Plan', 'Engage Actively'].map((step, index) => (
                <li key={step} className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg mr-4">{index + 1}</div>
                  <div>
                    <h4 className="font-semibold text-lg text-blue-700">{step}</h4>
                    <p className="text-muted-foreground text-sm">
                      {index === 0 && "Detail your profile to attract the right matches."}
                      {index === 1 && "Verify your identity for a trusted community."}
                      {index === 2 && "Subscribe to a premium plan to unlock all features."}
                      {index === 3 && "Don't just wait for matches. Actively search and post!"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section className="bg-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-12">Your Safety is Our Priority</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {safetyFeatures.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4 p-4 bg-background rounded-lg shadow-md">
                <div className="flex-shrink-0">{feature.icon}</div>
                <div>
                  <h4 className="font-semibold text-lg text-primary">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-12">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full max-w-3xl mx-auto">
          {faqItems.map((item, index) => (
            <AccordionItem value={`item-${index + 1}`} key={index}>
              <AccordionTrigger className="text-lg hover:no-underline">
                <div className="flex items-center">
                  <HelpCircle className="h-5 w-5 mr-3 text-primary"/>
                  {item.question}
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base">
                <div className="flex items-start p-2">
                  <Info className="h-5 w-5 mr-3 text-accent flex-shrink-0 mt-1"/>
                  {item.answer}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final Call to Action Section */}
      <section className="py-16 bg-gradient-to-tr from-accent to-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-8">Ready to Find Your Connection?</h2>
          <p className="text-xl text-primary-foreground mb-10 max-w-xl mx-auto">
            Join NukuConnect today and start your journey towards more fulfilling relationships.
          </p>
          <Button size="lg" asChild className="bg-background text-foreground hover:bg-background/90 transform hover:scale-105 transition-transform duration-300 px-10 py-6 text-lg">
            <Link href="/signup">Sign Up Now</Link>
          </Button>
          <div className="mt-8">
            <Image 
                src="https://placehold.co/800x300.png?text=Connect+with+NukuConnect"
                alt="Happy couple"
                width={800}
                height={300}
                className="rounded-lg shadow-2xl mx-auto"
                data-ai-hint="happy couple silhouette"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// Placeholder icons for FAQ if needed
const HelpCircle = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
);
const Info = ({ className }: { className?: string }) => (
 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
);

