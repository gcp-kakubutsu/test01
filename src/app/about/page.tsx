
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, HeartHandshake, Target } from "lucide-react";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <HeartHandshake className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">About NukuConnect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-10 text-lg text-muted-foreground leading-relaxed">
          <section className="text-center">
            <p className="max-w-3xl mx-auto">
              Welcome to NukuConnect, a place where genuine connections blossom. We believe in the power of shared interests and deep compatibility to foster meaningful relationships in the modern world.
            </p>
            <div className="my-8">
              <Image 
                src="https://placehold.co/800x400.png?text=Our+Community" 
                alt="NukuConnect Community" 
                width={800} 
                height={400} 
                className="rounded-lg shadow-lg mx-auto"
                data-ai-hint="diverse people connecting"
              />
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-semibold text-secondary-foreground mb-4 flex items-center">
                <Target className="h-8 w-8 text-accent mr-3" /> Our Mission
              </h2>
              <p>
                Our mission is to provide a safe, respectful, and innovative platform for adults to find partners who truly understand their desires and preferences. We aim to break down barriers and make the search for connection both exciting and fulfilling. At NukuConnect, we're committed to helping you build lasting bonds and enrich your intimate life.
              </p>
            </div>
            <div className="relative h-64 md:h-80 rounded-lg overflow-hidden shadow-md">
                <Image 
                    src="https://placehold.co/600x400.png?text=Shared+Goals" 
                    alt="Shared Goals" 
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint="couple planning future"
                />
            </div>
          </section>
          
          <section>
            <h2 className="text-3xl font-semibold text-secondary-foreground mb-6 text-center flex items-center justify-center">
              <Users className="h-8 w-8 text-accent mr-3" /> Why We Started
            </h2>
            <p className="max-w-3xl mx-auto text-center">
              NukuConnect was born from the idea that everyone deserves to find companionship that aligns with their deepest self. In a world full of fleeting interactions, we saw the need for a space that prioritizes authentic matching based on more than just superficial traits. We are passionate about using technology to facilitate human connection in more meaningful ways.
            </p>
          </section>

        </CardContent>
      </Card>
    </div>
  );
}
