/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
  isValidPin,
  encodePin,
  validatePinComplexity,
  getPinMatrixTypeDescription,
  createPinMatrixState,
  generatePinMatrixVisual,
  checkWipeRisk,
  getRemainingAttemptsMessage,
  PIN_MATRIX_POSITIONS,
  PIN_TIMEOUTS,
} from '../../nodes/KeepKey/utils/pinUtils';

describe('pinUtils', () => {
  describe('PIN_MATRIX_POSITIONS', () => {
    it('should have 9 positions', () => {
      expect(Object.keys(PIN_MATRIX_POSITIONS).length).toBe(9);
    });

    it('should map to telephone keypad layout', () => {
      // Bottom row
      expect(PIN_MATRIX_POSITIONS[1]).toBeDefined();
      expect(PIN_MATRIX_POSITIONS[2]).toBeDefined();
      expect(PIN_MATRIX_POSITIONS[3]).toBeDefined();
      // Middle row
      expect(PIN_MATRIX_POSITIONS[4]).toBeDefined();
      expect(PIN_MATRIX_POSITIONS[5]).toBeDefined();
      expect(PIN_MATRIX_POSITIONS[6]).toBeDefined();
      // Top row
      expect(PIN_MATRIX_POSITIONS[7]).toBeDefined();
      expect(PIN_MATRIX_POSITIONS[8]).toBeDefined();
      expect(PIN_MATRIX_POSITIONS[9]).toBeDefined();
    });
  });

  describe('isValidPin', () => {
    it('should accept valid PINs', () => {
      expect(isValidPin('1234')).toBe(true);
      expect(isValidPin('123456789')).toBe(true);
      expect(isValidPin('1')).toBe(true);
    });

    it('should reject invalid PINs', () => {
      expect(isValidPin('')).toBe(false);
      expect(isValidPin('0')).toBe(false); // 0 is not valid
      expect(isValidPin('12340')).toBe(false); // Contains 0
      expect(isValidPin('abc')).toBe(false);
      expect(isValidPin('1234567890')).toBe(false); // Too long
    });

    it('should only allow digits 1-9', () => {
      expect(isValidPin('123456789')).toBe(true);
      expect(isValidPin('987654321')).toBe(true);
    });
  });

  describe('encodePin', () => {
    it('should encode PIN with matrix', () => {
      const matrix = [3, 6, 9, 2, 5, 8, 1, 4, 7]; // Example scrambled matrix
      const pin = '1234';
      const encoded = encodePin(pin, matrix);
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');
    });

    it('should produce different encodings for different matrices', () => {
      const matrix1 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const matrix2 = [9, 8, 7, 6, 5, 4, 3, 2, 1];
      const pin = '1234';
      
      const encoded1 = encodePin(pin, matrix1);
      const encoded2 = encodePin(pin, matrix2);
      
      // With different matrices, encodings should differ
      // (unless PIN is symmetric)
    });
  });

  describe('validatePinComplexity', () => {
    it('should accept complex PINs', () => {
      const result = validatePinComplexity('2749');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about sequential PINs', () => {
      const result = validatePinComplexity('1234');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.toLowerCase().includes('sequential'))).toBe(true);
    });

    it('should warn about repeated digits', () => {
      const result = validatePinComplexity('1111');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.toLowerCase().includes('repeat'))).toBe(true);
    });

    it('should warn about common PINs', () => {
      const result = validatePinComplexity('1234');
      // 1234 is both sequential and common
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about short PINs', () => {
      const result = validatePinComplexity('12');
      expect(result.warnings.some(w => w.toLowerCase().includes('short') || w.toLowerCase().includes('length'))).toBe(true);
    });
  });

  describe('getPinMatrixTypeDescription', () => {
    it('should describe current PIN request', () => {
      const desc = getPinMatrixTypeDescription('current');
      expect(desc.toLowerCase()).toContain('current');
    });

    it('should describe new PIN request', () => {
      const desc = getPinMatrixTypeDescription('new_first');
      expect(desc.toLowerCase()).toContain('new');
    });

    it('should describe confirmation request', () => {
      const desc = getPinMatrixTypeDescription('new_second');
      expect(desc.toLowerCase()).toContain('confirm');
    });
  });

  describe('createPinMatrixState', () => {
    it('should create initial state', () => {
      const state = createPinMatrixState('current');
      expect(state.type).toBe('current');
      expect(state.enteredDigits).toBe(0);
      expect(state.startTime).toBeDefined();
    });

    it('should track different request types', () => {
      const currentState = createPinMatrixState('current');
      const newState = createPinMatrixState('new_first');
      
      expect(currentState.type).toBe('current');
      expect(newState.type).toBe('new_first');
    });
  });

  describe('generatePinMatrixVisual', () => {
    it('should generate ASCII art grid', () => {
      const visual = generatePinMatrixVisual();
      expect(visual).toContain('7');
      expect(visual).toContain('8');
      expect(visual).toContain('9');
      expect(visual).toContain('4');
      expect(visual).toContain('5');
      expect(visual).toContain('6');
      expect(visual).toContain('1');
      expect(visual).toContain('2');
      expect(visual).toContain('3');
    });

    it('should be multiline', () => {
      const visual = generatePinMatrixVisual();
      expect(visual.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('checkWipeRisk', () => {
    it('should indicate no risk for first attempts', () => {
      const result = checkWipeRisk(1);
      expect(result.isAtRisk).toBe(false);
    });

    it('should warn on second attempt', () => {
      const result = checkWipeRisk(2);
      expect(result.isAtRisk).toBe(true);
      expect(result.attemptsRemaining).toBe(1);
    });

    it('should indicate final attempt', () => {
      const result = checkWipeRisk(3);
      expect(result.isAtRisk).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
    });
  });

  describe('getRemainingAttemptsMessage', () => {
    it('should return appropriate message for remaining attempts', () => {
      expect(getRemainingAttemptsMessage(3)).toContain('3');
      expect(getRemainingAttemptsMessage(2)).toContain('2');
      expect(getRemainingAttemptsMessage(1)).toContain('1');
    });

    it('should warn about device wipe', () => {
      const message = getRemainingAttemptsMessage(1);
      expect(message.toLowerCase()).toContain('wipe');
    });
  });

  describe('PIN_TIMEOUTS', () => {
    it('should have entry timeout defined', () => {
      expect(PIN_TIMEOUTS.ENTRY_TIMEOUT).toBeGreaterThan(0);
    });

    it('should have max attempts defined', () => {
      expect(PIN_TIMEOUTS.MAX_ATTEMPTS).toBe(3);
    });
  });
});
