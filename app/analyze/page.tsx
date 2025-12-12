"use client"

import { useState } from "react"
import Navigation from "@/components/Navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, FileAudio } from "lucide-react"

export default function AnalyzePage() {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return
    
    try {
      const formData = new FormData()
      formData.append("audio_file", selectedFile)
      if (selectedFile.name) {
        // Try to extract title from filename
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "")
        formData.append("title", nameWithoutExt)
      }
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`Track uploaded! Track ID: ${data.track_id}\nStatus: ${data.status}\nAnalysis will begin shortly.`)
        setSelectedFile(null)
      } else {
        const error = await response.json()
        alert(`Upload failed: ${error.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload track. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Track Analysis</CardTitle>
            <CardDescription>
              Upload a track to analyze BPM, key, energy, and structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center ${
                dragActive ? "border-primary bg-primary/10" : "border-muted"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="mb-2">Drag and drop your audio file here</p>
              <p className="text-sm text-muted-foreground mb-4">or</p>
              <div>
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  type="button"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  Browse Files
                </Button>
              </div>
              {selectedFile && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <FileAudio className="w-5 h-5" />
                  <span>{selectedFile.name}</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Supported Formats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded">
                  <div className="font-semibold">MP3</div>
                  <div className="text-sm text-muted-foreground">
                    Most common format, good compression
                  </div>
                </div>
                <div className="p-4 border rounded">
                  <div className="font-semibold">WAV</div>
                  <div className="text-sm text-muted-foreground">
                    Uncompressed, high quality
                  </div>
                </div>
                <div className="p-4 border rounded">
                  <div className="font-semibold">FLAC</div>
                  <div className="text-sm text-muted-foreground">
                    Lossless compression
                  </div>
                </div>
                <div className="p-4 border rounded">
                  <div className="font-semibold">M4A</div>
                  <div className="text-sm text-muted-foreground">
                    Apple format, good quality
                  </div>
                </div>
              </div>
            </div>

            {selectedFile && (
              <Button className="mt-6 w-full" onClick={handleAnalyze}>
                Start Analysis
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

