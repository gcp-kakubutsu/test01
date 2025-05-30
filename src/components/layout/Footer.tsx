
import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-card text-card-foreground border-t py-8 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <div className="flex justify-center gap-4 mb-4">
          <Link href="/about" className="text-sm hover:text-primary">About Us</Link>
          <Link href="/terms" className="text-sm hover:text-primary">Terms of Service</Link>
          <Link href="/privacy" className="text-sm hover:text-primary">Privacy Policy</Link>
          <Link href="/contact" className="text-sm hover:text-primary">Contact</Link>
        </div>
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} NukuConnect. All rights reserved.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          NukuConnect is intended for adults (18+) only. Please use responsibly.
        </p>
      </div>
    </footer>
  );
}
