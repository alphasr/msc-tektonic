'use client';

import { useState, useEffect, useRef } from 'react';
import Navigation from '@/components/Navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetectedController, DriverStatus } from '@/types';
import { getMIDIController } from '@/lib/midi-controller';
import {
  checkDriverStatus,
  getDriverInstructions,
  getDriverDownloadUrl,
  detectOS,
} from '@/lib/driver-detector';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Download,
  Settings as SettingsIcon,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [detectedControllers, setDetectedControllers] = useState<
    DetectedController[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [learnMode, setLearnMode] = useState(false);
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [driverDialogs, setDriverDialogs] = useState<Record<string, boolean>>(
    {}
  );
  const [learnModeCallback, setLearnModeCallback] = useState<
    ((value: number, control: string) => void) | null
  >(null);
  const [capturedMapping, setCapturedMapping] = useState<{
    type: 'note' | 'cc';
    value: number;
    channel?: number;
  } | null>(null);
  const midiControllerRef = useRef<ReturnType<typeof getMIDIController> | null>(
    null
  );

  useEffect(() => {
    initializeMIDI();
    return () => {
      if (midiControllerRef.current) {
        midiControllerRef.current.offDetection(handleControllerDetection);
      }
    };
  }, []);

  const initializeMIDI = async () => {
    try {
      midiControllerRef.current = getMIDIController();

      // Register detection callback
      midiControllerRef.current.onDetection(handleControllerDetection);

      // Initialize and detect
      const success = await midiControllerRef.current.initialize();
      if (success) {
        // Controllers are detected during initialization
        const controllers = midiControllerRef.current.getDetectedControllers();
        setDetectedControllers(controllers);
      }
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
    } finally {
      setLoading(false);
    }
  };

  const startLearnMode = () => {
    if (!midiControllerRef.current) return;

    setLearnMode(true);
    setCapturedMapping(null);

    // Set learn mode on MIDI controller
    midiControllerRef.current.setLearnMode(true, (type, value, channel) => {
      if (selectedControl) {
        setCapturedMapping({ type, value, channel });
      }
    });
  };

  const stopLearnMode = () => {
    if (midiControllerRef.current) {
      midiControllerRef.current.setLearnMode(false);
    }
    setLearnMode(false);
    setSelectedControl(null);
    setCapturedMapping(null);
    setLearnModeCallback(null);
  };

  const saveLearnedMapping = () => {
    if (
      !selectedControl ||
      !capturedMapping ||
      !midiControllerRef.current ||
      detectedControllers.length === 0
    ) {
      return;
    }

    const controller = detectedControllers[0];
    const mappingKey = selectedControl as keyof typeof controller.mapping;

    // Create mapping update
    const mappingUpdate: Partial<import('@/types').MIDIMapping> = {};
    mappingUpdate[mappingKey] = capturedMapping.value;

    // Save to controller
    midiControllerRef.current.saveCustomMapping(controller.id, mappingUpdate);

    // Apply the new mapping
    midiControllerRef.current.setMapping(mappingUpdate);

    // Reset learn mode
    setCapturedMapping(null);
    setSelectedControl(null);

    alert(
      `Mapping saved: ${selectedControl} = ${
        capturedMapping.type === 'note' ? 'Note' : 'CC'
      } ${capturedMapping.value}`
    );
  };

  const handleControllerDetection = (controllers: DetectedController[]) => {
    setDetectedControllers(controllers);
  };

  const refreshControllers = async () => {
    if (midiControllerRef.current) {
      await midiControllerRef.current.detectControllers();
      const controllers = midiControllerRef.current.getDetectedControllers();
      setDetectedControllers(controllers);
    }
  };

  const getDriverStatusIcon = (status: DriverStatus) => {
    switch (status) {
      case 'not_required':
        return <CheckCircle2 className='w-4 h-4 text-green-500' />;
      case 'needed':
        return <AlertCircle className='w-4 h-4 text-yellow-500' />;
      case 'installed':
        return <CheckCircle2 className='w-4 h-4 text-green-500' />;
      default:
        return <AlertCircle className='w-4 h-4 text-muted-foreground' />;
    }
  };

  const getDriverStatusText = (status: DriverStatus) => {
    switch (status) {
      case 'not_required':
        return 'Not Required';
      case 'needed':
        return 'Driver Needed';
      case 'installed':
        return 'Installed';
      default:
        return 'Unknown';
    }
  };

  const openDriverDialog = (controllerId: string) => {
    setDriverDialogs((prev) => ({ ...prev, [controllerId]: true }));
  };

  const closeDriverDialog = (controllerId: string) => {
    setDriverDialogs((prev) => ({ ...prev, [controllerId]: false }));
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-background'>
        <Navigation />
        <div className='container mx-auto p-8'>
          <div>Loading MIDI controllers...</div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background'>
      <Navigation />
      <div className='container mx-auto p-8'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-3xl font-bold mb-2'>Controller Settings</h1>
            <p className='text-muted-foreground'>
              Manage MIDI controllers and mappings
            </p>
          </div>
          <Button onClick={refreshControllers} variant='outline'>
            <RefreshCw className='w-4 h-4 mr-2' />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue='controllers' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='controllers'>Detected Controllers</TabsTrigger>
            <TabsTrigger value='mapping'>Mapping</TabsTrigger>
          </TabsList>

          <TabsContent value='controllers' className='space-y-4'>
            {detectedControllers.length === 0 ? (
              <Card>
                <CardContent className='pt-6'>
                  <div className='text-center py-8'>
                    <AlertCircle className='w-12 h-12 mx-auto text-muted-foreground mb-4' />
                    <h3 className='text-lg font-semibold mb-2'>
                      No Controllers Detected
                    </h3>
                    <p className='text-muted-foreground mb-4'>
                      Connect a MIDI controller and click Refresh to detect it.
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      Make sure your controller is connected via USB and that
                      your browser supports Web MIDI API (Chrome/Edge
                      recommended).
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              detectedControllers.map((controller) => {
                const driverStatus = checkDriverStatus(controller.id);
                const driverInstructions = getDriverInstructions(controller.id);
                const downloadUrl = getDriverDownloadUrl(controller.id);

                return (
                  <Card key={controller.id}>
                    <CardHeader>
                      <div className='flex items-center justify-between'>
                        <div>
                          <CardTitle>{controller.name}</CardTitle>
                          <CardDescription>
                            {controller.manufacturer} • Confidence:{' '}
                            {controller.confidence}
                          </CardDescription>
                        </div>
                        <div className='flex items-center gap-2'>
                          {getDriverStatusIcon(driverStatus)}
                          <span className='text-sm text-muted-foreground'>
                            {getDriverStatusText(driverStatus)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className='space-y-4'>
                        <div>
                          <h4 className='text-sm font-semibold mb-2'>
                            Controller Information
                          </h4>
                          <div className='grid grid-cols-2 gap-2 text-sm'>
                            <div>
                              <span className='text-muted-foreground'>
                                Model:
                              </span>{' '}
                              {controller.model}
                            </div>
                            <div>
                              <span className='text-muted-foreground'>
                                Device ID:
                              </span>{' '}
                              {controller.deviceId || 'N/A'}
                            </div>
                            <div>
                              <span className='text-muted-foreground'>
                                Detection:
                              </span>{' '}
                              <span
                                className={cn(
                                  controller.confidence === 'high' &&
                                    'text-green-500',
                                  controller.confidence === 'medium' &&
                                    'text-yellow-500',
                                  controller.confidence === 'low' &&
                                    'text-orange-500'
                                )}
                              >
                                {controller.confidence.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <span className='text-muted-foreground'>OS:</span>{' '}
                              {detectOS()}
                            </div>
                          </div>
                        </div>

                        {driverStatus === 'needed' && (
                          <div className='border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20'>
                            <div className='flex items-start justify-between'>
                              <div className='flex-1'>
                                <h4 className='text-sm font-semibold mb-2'>
                                  Driver Installation Required
                                </h4>
                                <ul className='text-sm space-y-1 text-muted-foreground'>
                                  {driverInstructions
                                    .slice(0, 2)
                                    .map((instruction, idx) => (
                                      <li key={idx}>• {instruction}</li>
                                    ))}
                                </ul>
                              </div>
                              <Dialog
                                open={driverDialogs[controller.id]}
                                onOpenChange={(open) =>
                                  open
                                    ? openDriverDialog(controller.id)
                                    : closeDriverDialog(controller.id)
                                }
                              >
                                <DialogTrigger asChild>
                                  <Button variant='outline' size='sm'>
                                    <Download className='w-4 h-4 mr-2' />
                                    View Instructions
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Driver Installation Guide
                                    </DialogTitle>
                                    <DialogDescription>
                                      Instructions for {controller.name}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className='space-y-4'>
                                    <div>
                                      <h4 className='font-semibold mb-2'>
                                        Operating System: {detectOS()}
                                      </h4>
                                      <ul className='list-disc list-inside space-y-1 text-sm text-muted-foreground'>
                                        {driverInstructions.map(
                                          (instruction, idx) => (
                                            <li key={idx}>{instruction}</li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                    {downloadUrl && (
                                      <div>
                                        <Button asChild>
                                          <a
                                            href={downloadUrl}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                          >
                                            <Download className='w-4 h-4 mr-2' />
                                            Download Driver
                                          </a>
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        )}

                        {driverStatus === 'not_required' && (
                          <div className='text-sm text-green-600 dark:text-green-400'>
                            ✓ This controller is USB class-compliant and works
                            without additional drivers.
                          </div>
                        )}

                        <div className='flex gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              if (midiControllerRef.current) {
                                midiControllerRef.current.setControllerProfile(
                                  controller.id
                                );
                              }
                            }}
                          >
                            Apply Mapping
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={startLearnMode}
                          >
                            <Keyboard className='w-4 h-4 mr-2' />
                            Learn Mode
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value='mapping' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle>Custom Mapping</CardTitle>
                <CardDescription>
                  Customize MIDI mappings for your controllers. Use Learn Mode
                  to assign controls.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {learnMode ? (
                  <div className='space-y-4'>
                    <div className='border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20'>
                      <h4 className='font-semibold mb-2'>Learn Mode Active</h4>
                      <p className='text-sm text-muted-foreground mb-4'>
                        Click on a control below, then press the button or move
                        the fader on your controller to assign it.
                      </p>
                      <Button
                        onClick={stopLearnMode}
                        variant='outline'
                        size='sm'
                      >
                        Exit Learn Mode
                      </Button>
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <h4 className='font-semibold mb-2'>Deck A Controls</h4>
                        <div className='space-y-2'>
                          {[
                            'deckA_play',
                            'deckA_pause',
                            'deckA_stop',
                            'deckA_cue',
                            'deckA_volume',
                            'deckA_low',
                            'deckA_mid',
                            'deckA_high',
                          ].map((control) => (
                            <Button
                              key={control}
                              variant={
                                selectedControl === control
                                  ? 'default'
                                  : 'outline'
                              }
                              size='sm'
                              className='w-full justify-start'
                              onClick={() => setSelectedControl(control)}
                            >
                              {control.replace('deckA_', '').replace(/_/g, ' ')}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className='font-semibold mb-2'>Deck B Controls</h4>
                        <div className='space-y-2'>
                          {[
                            'deckB_play',
                            'deckB_pause',
                            'deckB_stop',
                            'deckB_cue',
                            'deckB_volume',
                            'deckB_low',
                            'deckB_mid',
                            'deckB_high',
                          ].map((control) => (
                            <Button
                              key={control}
                              variant={
                                selectedControl === control
                                  ? 'default'
                                  : 'outline'
                              }
                              size='sm'
                              className='w-full justify-start'
                              onClick={() => setSelectedControl(control)}
                            >
                              {control.replace('deckB_', '').replace(/_/g, ' ')}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {selectedControl && (
                      <div className='border rounded-lg p-4 bg-green-50 dark:bg-green-900/20'>
                        <p className='text-sm mb-2'>
                          Waiting for MIDI input for:{' '}
                          <strong>{selectedControl}</strong>
                        </p>
                        {capturedMapping ? (
                          <div className='space-y-2'>
                            <p className='text-xs text-muted-foreground'>
                              Captured: {capturedMapping.type.toUpperCase()}{' '}
                              {capturedMapping.value}
                              {capturedMapping.channel !== undefined &&
                                ` (Channel ${capturedMapping.channel})`}
                            </p>
                            <div className='flex gap-2'>
                              <Button size='sm' onClick={saveLearnedMapping}>
                                Save Mapping
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() => {
                                  setCapturedMapping(null);
                                  setSelectedControl(null);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className='text-xs text-muted-foreground'>
                            Press a button or move a fader on your controller...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className='text-center py-8'>
                    <SettingsIcon className='w-12 h-12 mx-auto text-muted-foreground mb-4' />
                    <h3 className='text-lg font-semibold mb-2'>
                      No Custom Mappings
                    </h3>
                    <p className='text-muted-foreground mb-4'>
                      Use Learn Mode to create custom mappings for your
                      controller.
                    </p>
                    <Button onClick={startLearnMode}>
                      <Keyboard className='w-4 h-4 mr-2' />
                      Start Learn Mode
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
