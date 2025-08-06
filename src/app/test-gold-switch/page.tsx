'use client'

import { useState, useEffect } from 'react'
import { GoldSwitch } from '@/components/ui/gold-switch'

export default function TestGoldSwitch() {
  const [checked, setChecked] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Gold Switch Test</h1>
        
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="mb-4">Debug Info:</h2>
          <p>Mounted: {mounted ? 'Yes' : 'No'}</p>
          <p>Checked State: {checked ? 'true' : 'false'}</p>
          
          <div className="mt-4 space-y-4">
            <div>
              <label>Gold Switch (starts checked):</label>
              <GoldSwitch 
                checked={checked}
                onCheckedChange={setChecked}
              />
            </div>
            
            <div className="p-4 bg-muted rounded">
              <p className="text-sm">Expected behavior:</p>
              <ul className="text-sm list-disc list-inside mt-2">
                <li>Gold background when checked</li>
                <li>White thumb/circle should be visible</li>
                <li>Thumb should move to the right when checked</li>
              </ul>
            </div>
            
            <button 
              onClick={() => setChecked(!checked)}
              className="px-4 py-2 bg-primary text-white rounded"
            >
              Toggle Switch
            </button>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <h3 className="mb-2">CSS Classes Applied:</h3>
          <pre className="text-xs overflow-auto bg-muted p-2 rounded">
            {`Switch Root: 
- peer inline-flex h-6 w-11 shrink-0 cursor-pointer 
- items-center rounded-full border-2 border-transparent 
- transition-colors focus-visible:outline-none 
- focus-visible:ring-2 focus-visible:ring-ring 
- focus-visible:ring-offset-2 
- focus-visible:ring-offset-background 
- disabled:cursor-not-allowed disabled:opacity-50
- [&[data-state=checked]]:!bg-[#D4AF37]
- [&[data-state=unchecked]]:bg-gray-300 
- dark:[&[data-state=unchecked]]:bg-gray-700

Thumb:
- pointer-events-none block h-5 w-5 rounded-full 
- bg-white shadow-lg ring-0 transition-transform 
- data-[state=checked]:translate-x-5 
- data-[state=unchecked]:translate-x-0`}
          </pre>
        </div>
      </div>
    </div>
  )
}