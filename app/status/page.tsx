"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/Navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SystemStatus } from "@/types"
import { cn } from "@/lib/utils"
import { RefreshCw, CheckCircle2, AlertCircle, XCircle } from "lucide-react"

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/status")
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error("Failed to fetch status:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case "degraded":
        return <AlertCircle className="w-5 h-5 text-cyan-500" />
      case "outage":
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "operational":
        return "Operational"
      case "degraded":
        return "Degraded"
      case "outage":
        return "Major Outage"
      default:
        return "Unknown"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "text-green-500"
      case "degraded":
        return "text-cyan-500"
      case "outage":
        return "text-red-500"
      default:
        return "text-muted-foreground"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto p-8">
          <div>Loading...</div>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto p-8">
          <div>Failed to load status</div>
        </div>
      </div>
    )
  }

  const services = [
    { name: "Backend API", status: status.backend },
    { name: "Database", status: status.database },
    { name: "Storage Service", status: status.storage },
    { name: "Analysis Engine", status: status.analysis },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">System Status</h1>
          <Button onClick={fetchStatus} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Service Monitoring</CardTitle>
            <CardDescription>Real-time status of all system services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <div className="font-semibold">{service.name}</div>
                      <div className={cn("text-sm", getStatusColor(service.status))}>
                        {getStatusText(service.status)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Metrics</CardTitle>
            <CardDescription>Performance and health indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{status.latency?.toFixed(1) || "N/A"} ms</div>
                <div className="text-sm text-muted-foreground">Latency</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {services.filter((s) => s.status === "operational").length} / {services.length}
                </div>
                <div className="text-sm text-muted-foreground">Services Operational</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

