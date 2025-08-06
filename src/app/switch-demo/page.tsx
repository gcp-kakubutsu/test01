'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { GoldSwitch } from '@/components/ui/gold-switch'

export default function SwitchDemoPage() {
  const [regularChecked, setRegularChecked] = useState(false)
  const [goldChecked, setGoldChecked] = useState(false)

  return (
    <div className="min-h-screen p-8 bg-background flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <h1 className="text-3xl font-bold text-center mb-8">Switch Components Comparison</h1>
        
        <div className="space-y-4">
          {/* Regular Switch */}
          <div className="bg-card p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Regular Switch (Primary Color - Pink)</h2>
            <div className="flex items-center space-x-4">
              <Switch
                checked={regularChecked}
                onCheckedChange={setRegularChecked}
              />
              <span className="text-sm">
                {regularChecked ? '✓ Checked' : '○ Unchecked'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Uses default primary color (pink/magenta)
            </p>
          </div>

          {/* Gold Switch */}
          <div className="bg-card p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Gold Switch (Custom Component)</h2>
            <div className="flex items-center space-x-4">
              <GoldSwitch
                checked={goldChecked}
                onCheckedChange={setGoldChecked}
              />
              <span className="text-sm">
                {goldChecked ? '✓ Checked' : '○ Unchecked'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Uses gold color (#D4AF37) when checked
            </p>
          </div>

          {/* Color Reference */}
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="font-semibold mb-3">Color Reference</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded" />
                <span className="text-sm">Primary (Pink/Magenta)</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-[#D4AF37] rounded" />
                <span className="text-sm">Gold (#D4AF37)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}