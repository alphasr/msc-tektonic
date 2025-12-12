"use client"

import { useState, useEffect } from "react"
import Navigation from "@/components/Navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

export default function SearchPage() {
  const [trackId, setTrackId] = useState("")
  const [scope, setScope] = useState("phrase")
  const [k, setK] = useState(10)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!trackId) return
    setLoading(true)
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, scope, k }),
      })
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error("Failed to search:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Similarity Search</CardTitle>
            <CardDescription>
              Find similar segments across your library
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Track</label>
                <Input
                  placeholder="Track ID or name"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Search Scope</label>
                <Select value={scope} onValueChange={setScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar level</SelectItem>
                    <SelectItem value="phrase">Phrase level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Number of Results (k)</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={k}
                  onChange={(e) => setK(parseInt(e.target.value))}
                />
              </div>
            </div>

            <Button onClick={handleSearch} disabled={loading || !trackId}>
              {loading ? "Searching..." : "Search"}
            </Button>

            {results.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Results</h3>
                <div className="space-y-2">
                  {results.map((result, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{result.metadata.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {result.metadata.artist} • {result.metadata.bpm} BPM
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Position: {formatTime(result.position)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-primary">
                              {(result.score * 100).toFixed(1)}%
                            </div>
                            <div className="text-xs text-muted-foreground">Similarity</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

