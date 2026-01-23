/**
 * Tests for Logger Utility
 * Tests conditional logging behavior based on environment
 */

describe('Logger Utility', () => {
  let originalEnv;
  let consoleSpy;
  let logger;

  beforeEach(() => {
    // Save original NODE_ENV
    originalEnv = process.env.NODE_ENV;

    // Clear module cache to allow re-import with different env
    jest.resetModules();

    // Spy on console methods
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      group: jest.spyOn(console, 'group').mockImplementation(() => {}),
      groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      table: jest.spyOn(console, 'table').mockImplementation(() => {}),
      time: jest.spyOn(console, 'time').mockImplementation(() => {}),
      timeEnd: jest.spyOn(console, 'timeEnd').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;

    // Restore console methods
    Object.values(consoleSpy).forEach(spy => spy.mockRestore());
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      logger = require('../utils/logger').default;
    });

    test('debug logs in development', () => {
      logger.debug('Test debug message');
      expect(consoleSpy.log).toHaveBeenCalledWith('[DEBUG] Test debug message');
    });

    test('debug logs with additional arguments', () => {
      const extraData = { key: 'value' };
      logger.debug('Test message', extraData);
      expect(consoleSpy.log).toHaveBeenCalledWith('[DEBUG] Test message', extraData);
    });

    test('info logs in development', () => {
      logger.info('Test info message');
      expect(consoleSpy.info).toHaveBeenCalledWith('[INFO] Test info message');
    });

    test('warn logs in development', () => {
      logger.warn('Test warning');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] Test warning');
    });

    test('error logs in development with full detail', () => {
      logger.error('Test error', { detail: 'extra' });
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Test error', { detail: 'extra' });
    });

    test('api logs in development', () => {
      logger.api('/api/test', 'GET');
      expect(consoleSpy.log).toHaveBeenCalledWith('[API] GET /api/test', '');
    });

    test('api logs with data', () => {
      const data = { userId: '123' };
      logger.api('/api/test', 'POST', data);
      expect(consoleSpy.log).toHaveBeenCalledWith('[API] POST /api/test', data);
    });

    test('state logs in development', () => {
      logger.state('activeModule', 'family', 'work');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '[STATE] activeModule:',
        { from: 'family', to: 'work' }
      );
    });

    test('component logs in development', () => {
      logger.component('RightSidebar', 'mount');
      expect(consoleSpy.log).toHaveBeenCalledWith('[COMPONENT] RightSidebar - mount', '');
    });

    test('component logs with data', () => {
      const props = { activeModule: 'family' };
      logger.component('RightSidebar', 'update', props);
      expect(consoleSpy.log).toHaveBeenCalledWith('[COMPONENT] RightSidebar - update', props);
    });

    test('group calls console.group in development', () => {
      const callback = jest.fn();
      logger.group('Test Group', callback);
      expect(consoleSpy.group).toHaveBeenCalledWith('Test Group');
      expect(callback).toHaveBeenCalled();
      expect(consoleSpy.groupEnd).toHaveBeenCalled();
    });

    test('table logs in development', () => {
      const data = [{ name: 'Test' }];
      logger.table(data);
      expect(consoleSpy.table).toHaveBeenCalledWith(data);
    });

    test('time measures execution in development', async () => {
      const callback = jest.fn().mockResolvedValue('result');
      const result = await logger.time('Test Timer', callback);
      expect(consoleSpy.time).toHaveBeenCalledWith('Test Timer');
      expect(consoleSpy.timeEnd).toHaveBeenCalledWith('Test Timer');
      expect(result).toBe('result');
    });
  });

  describe('Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      logger = require('../utils/logger').default;
    });

    test('debug does not log in production', () => {
      logger.debug('Test debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    test('info does not log in production', () => {
      logger.info('Test info message');
      expect(consoleSpy.info).not.toHaveBeenCalled();
    });

    test('warn does not log in production', () => {
      logger.warn('Test warning');
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });

    test('error logs minimal info in production', () => {
      logger.error('Test error', { detail: 'extra' });
      // In production, error still logs but with minimal info
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Test error');
    });

    test('api does not log in production', () => {
      logger.api('/api/test', 'GET');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    test('state does not log in production', () => {
      logger.state('activeModule', 'family', 'work');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    test('component does not log in production', () => {
      logger.component('RightSidebar', 'mount');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    test('group does not call console.group in production', () => {
      const callback = jest.fn();
      logger.group('Test Group', callback);
      expect(consoleSpy.group).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(consoleSpy.groupEnd).not.toHaveBeenCalled();
    });

    test('table does not log in production', () => {
      const data = [{ name: 'Test' }];
      logger.table(data);
      expect(consoleSpy.table).not.toHaveBeenCalled();
    });

    test('time skips timing but executes callback in production', async () => {
      const callback = jest.fn().mockResolvedValue('result');
      const result = await logger.time('Test Timer', callback);
      expect(consoleSpy.time).not.toHaveBeenCalled();
      expect(consoleSpy.timeEnd).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalled();
      expect(result).toBe('result');
    });
  });
});
