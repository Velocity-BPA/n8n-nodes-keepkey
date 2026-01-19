/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * PIN matrix utilities for KeepKey device interaction
 */

/**
 * PIN matrix positions mapping (telephone keypad layout)
 * The device displays a scrambled 3x3 grid, user enters positions
 */
export const PIN_MATRIX_POSITIONS: Record<number, string> = {
  1: 'BOTTOM_LEFT',
  2: 'BOTTOM_CENTER',
  3: 'BOTTOM_RIGHT',
  4: 'MIDDLE_LEFT',
  5: 'MIDDLE_CENTER',
  6: 'MIDDLE_RIGHT',
  7: 'TOP_LEFT',
  8: 'TOP_CENTER',
  9: 'TOP_RIGHT',
};

/**
 * PIN timeouts and limits
 */
export const PIN_TIMEOUTS = {
  ENTRY_TIMEOUT: 120000, // 2 minutes
  MAX_ATTEMPTS: 3,
};

export interface PinMatrixState {
  type: string;
  message: string;
  enteredDigits: number;
  startTime: number;
}

export interface WipeRiskResult {
  isAtRisk: boolean;
  attemptsRemaining: number;
}

export interface PinComplexityResult {
  isValid: boolean;
  warnings: string[];
}

/**
 * Validate PIN format
 * PIN must be 1-9 digits, each digit between 1-9
 */
export function isValidPin(pin: string): boolean {
  if (!pin || pin.length < 1 || pin.length > 9) {
    return false;
  }
  return /^[1-9]+$/.test(pin);
}

/**
 * Encode PIN using the matrix displayed on device
 * The matrix is a 9-element array representing the scrambled grid
 */
export function encodePin(pin: string, matrix?: number[]): string {
  if (!isValidPin(pin)) {
    throw new Error('Invalid PIN format. PIN must be 1-9 digits, each between 1-9.');
  }
  
  if (!matrix) {
    // Without a matrix, just return the pin as-is
    return pin;
  }
  
  // Map each PIN digit to its position in the scrambled matrix
  let encoded = '';
  for (const digit of pin) {
    const value = parseInt(digit, 10);
    // Find where this value appears in the matrix
    const position = matrix.indexOf(value);
    if (position !== -1) {
      encoded += (position + 1).toString();
    } else {
      encoded += digit;
    }
  }
  
  return encoded;
}

/**
 * Get PIN matrix type description
 */
export function getPinMatrixTypeDescription(type: string | number): string {
  // Handle numeric types (1=current, 2=new, 3=confirm)
  if (typeof type === 'number') {
    switch (type) {
      case 1:
        return 'Enter your current PIN';
      case 2:
        return 'Enter a new PIN';
      case 3:
        return 'Confirm your new PIN';
      default:
        return 'Enter PIN';
    }
  }
  
  switch (type) {
    case 'current':
      return 'Enter your current PIN';
    case 'new':
    case 'new_first':
      return 'Enter a new PIN';
    case 'confirm':
    case 'new_second':
      return 'Confirm your new PIN';
    default:
      return 'Enter PIN';
  }
}

/**
 * Create PIN matrix state
 */
export function createPinMatrixState(type: string): PinMatrixState {
  return {
    type,
    message: getPinMatrixTypeDescription(type),
    enteredDigits: 0,
    startTime: Date.now(),
  };
}

/**
 * Validate PIN complexity
 * Returns warnings for weak PINs
 */
export function validatePinComplexity(pin: string): PinComplexityResult {
  const warnings: string[] = [];
  
  if (!isValidPin(pin)) {
    return { isValid: false, warnings: ['Invalid PIN format'] };
  }
  
  // Check length
  if (pin.length < 4) {
    warnings.push('PIN is too short. Consider using at least 4 digits for better security.');
  }
  
  // Check for all same digits
  if (/^(.)\1+$/.test(pin)) {
    warnings.push('PIN contains all repeated digits. This is easy to guess.');
  }
  
  // Check for sequential patterns
  const sequential = '123456789';
  const reverseSequential = '987654321';
  if (sequential.includes(pin) || reverseSequential.includes(pin)) {
    warnings.push('PIN contains sequential digits. This is easy to guess.');
  }
  
  // Check for common PINs
  const commonPins = ['1234', '4321', '1111', '1212', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];
  if (commonPins.includes(pin)) {
    warnings.push('This is a commonly used PIN. Consider using something more unique.');
  }
  
  return {
    isValid: true,
    warnings,
  };
}

/**
 * Check wipe risk based on failed attempts
 */
export function checkWipeRisk(failedAttempts: number): WipeRiskResult {
  const maxAttempts = PIN_TIMEOUTS.MAX_ATTEMPTS;
  const attemptsRemaining = Math.max(0, maxAttempts - failedAttempts);
  
  return {
    isAtRisk: failedAttempts >= 2,
    attemptsRemaining,
  };
}

/**
 * Get remaining attempts message
 */
export function getRemainingAttemptsMessage(attemptsRemaining: number): string {
  if (attemptsRemaining <= 0) {
    return '0 PIN attempts remaining. Device will be wiped on next failed attempt.';
  }
  if (attemptsRemaining === 1) {
    return '1 PIN attempt remaining. WARNING: Device will be wiped on next failed attempt!';
  }
  return `${attemptsRemaining} PIN attempts remaining.`;
}

/**
 * Generate visual representation of PIN matrix
 */
export function generatePinMatrixVisual(): string {
  return [
    '┌───┬───┬───┐',
    '│ 7 │ 8 │ 9 │',
    '├───┼───┼───┤',
    '│ 4 │ 5 │ 6 │',
    '├───┼───┼───┤',
    '│ 1 │ 2 │ 3 │',
    '└───┴───┴───┘',
  ].join('\n');
}

/**
 * Calculate PIN entry timeout remaining
 */
export function getPinEntryTimeRemaining(startTime: number): number {
  const elapsed = Date.now() - startTime;
  const remaining = PIN_TIMEOUTS.ENTRY_TIMEOUT - elapsed;
  return Math.max(0, remaining);
}

/**
 * Check if PIN entry has timed out
 */
export function isPinEntryTimedOut(startTime: number): boolean {
  return getPinEntryTimeRemaining(startTime) === 0;
}
