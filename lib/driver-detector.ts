// Driver Detection and Guidance System
import { DriverInfo, DriverStatus } from '@/types';
import { getControllerById } from './controller-database';

/**
 * Detect the operating system
 */
export function detectOS(): 'windows' | 'macos' | 'linux' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();

  if (platform.includes('win') || userAgent.includes('windows')) {
    return 'windows';
  } else if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'macos';
  } else if (platform.includes('linux') || userAgent.includes('linux')) {
    return 'linux';
  }

  return 'unknown';
}

/**
 * Get driver information for a controller on the current OS
 */
export function getDriverInfo(controllerId: string): DriverInfo | null {
  const controller = getControllerById(controllerId);
  if (!controller) return null;

  const os = detectOS();
  const driverInfo = controller.drivers[os] || controller.drivers.all || null;

  return driverInfo;
}

/**
 * Check driver status for a controller
 */
export function checkDriverStatus(controllerId: string): DriverStatus {
  const driverInfo = getDriverInfo(controllerId);

  if (!driverInfo) {
    return 'unknown';
  }

  if (!driverInfo.required || driverInfo.classCompliant) {
    return 'not_required';
  }

  // In a real implementation, we could check if drivers are installed
  // For now, we'll assume they need to be installed if required
  // This could be enhanced with system checks or user input
  return 'needed';
}

/**
 * Get driver installation instructions
 */
export function getDriverInstructions(controllerId: string): string[] {
  const driverInfo = getDriverInfo(controllerId);

  if (!driverInfo) {
    return ['Driver information not available for this controller.'];
  }

  if (!driverInfo.required || driverInfo.classCompliant) {
    return driverInfo.instructions;
  }

  return driverInfo.instructions;
}

/**
 * Get driver download URL if available
 */
export function getDriverDownloadUrl(controllerId: string): string | null {
  const driverInfo = getDriverInfo(controllerId);
  return driverInfo?.downloadUrl || null;
}
