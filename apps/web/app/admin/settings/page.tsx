// apps/web/app/admin/settings/page.tsx
'use client'

import { useState } from 'react'
import { Header } from '@/components/admin/layout/Header'
import { microgrammaBold } from '@/lib/fonts'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F0FAF5]">
      <Header title="Settings" onMenuClick={() => setDrawerOpen(true)} />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="bg-white border border-[#CAEDE6]/60 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F5F2] border border-[#CAEDE6] text-[#074139] flex items-center justify-center mx-auto mb-4">
            <Settings className="w-7 h-7" />
          </div>
          <h2 className={`${microgrammaBold.className} text-xl font-bold text-[#074139] mb-2`}>
            System & Operations Settings
          </h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Centralized workspace configurations, tax policies, courier integrations, and administrative preferences are configured through the OBPark operations pipeline.
          </p>
        </div>
      </div>
    </div>
  )
}
