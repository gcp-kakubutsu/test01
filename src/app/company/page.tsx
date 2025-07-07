"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function CompanyPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <Building2 className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-4xl font-bold text-primary">会社概要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground">
          <div className="max-w-2xl mx-auto">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-4 text-lg font-medium text-secondary-foreground w-1/3">会社名</td>
                  <td className="py-4 text-lg">PEDIA株式会社（ペディア カブシキガイシャ）</td>
                </tr>
                <tr>
                  <td className="py-4 text-lg font-medium text-secondary-foreground w-1/3">所在地</td>
                  <td className="py-4 text-lg">〒464-0075　名古屋市千種区内山1-9-2</td>
                </tr>
                <tr>
                  <td className="py-4 text-lg font-medium text-secondary-foreground w-1/3">代表者</td>
                  <td className="py-4 text-lg">桐山 一喜</td>
                </tr>
                <tr>
                  <td className="py-4 text-lg font-medium text-secondary-foreground w-1/3">資本金</td>
                  <td className="py-4 text-lg">100万円</td>
                </tr>
                <tr>
                  <td className="py-4 text-lg font-medium text-secondary-foreground w-1/3">設立日</td>
                  <td className="py-4 text-lg">2025年6月23日</td>
                </tr>
                <tr>
                  <td className="py-4 text-lg font-medium text-secondary-foreground w-1/3">決算月</td>
                  <td className="py-4 text-lg">5月31日</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}