'use strict';

function isJsonContentType(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.split(';')[0].trim().toLowerCase();
  return normalized === 'application/json' || normalized === 'application/ld+json';
}

function parseJsonBody(req, options = {}) {
  const { limit = 1_048_576, requireJsonContentType = true, allowEmpty = true, timeout = 10_000, signal } = options;

  return new Promise((resolve, reject) => {
    let raw = '';
    let aborted = false;
    let bytesReceived = 0;
    let timer;

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('close', onClose);
      req.removeListener('aborted', onAbortEvent);
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (signal) {
        signal.removeEventListener('abort', onSignalAbort);
      }
    };

    const onError = error => {
      if (aborted) {
        return;
      }
      aborted = true;
      cleanup();
      reject(error instanceof Error ? error : new Error('Request error'));
    };

    const onClose = () => {
      if (aborted) {
        return;
      }
      aborted = true;
      cleanup();
      reject(new Error('Request aborted'));
    };

    const onAbortEvent = () => {
      if (aborted) {
        return;
      }
      aborted = true;
      cleanup();
      reject(new Error('Request aborted'));
    };

    const onTimeout = () => {
      if (aborted) {
        return;
      }
      aborted = true;
      cleanup();
      req.destroy();
      reject(new Error('Request body read timeout'));
    };

    const onSignalAbort = () => {
      if (aborted) {
        return;
      }
      aborted = true;
      cleanup();
      req.destroy();
      reject(new Error('Request aborted by signal'));
    };

    if (requireJsonContentType) {
      const contentType = req.headers['content-type'];
      if (!isJsonContentType(contentType)) {
        aborted = true;
        reject(new Error('Unsupported Content-Type. Expected application/json'));
        return;
      }
    }

    const contentLengthHeader = req.headers['content-length'];
    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(contentLength) && contentLength > limit) {
        aborted = true;
        reject(new Error('Payload too large'));
        return;
      }
    }

    if (typeof req.setEncoding === 'function') {
      req.setEncoding('utf8');
    }

    if (signal) {
      if (signal.aborted) {
        aborted = true;
        reject(new Error('Request aborted by signal'));
        return;
      }
      signal.addEventListener('abort', onSignalAbort);
    }

    if (Number.isFinite(timeout) && timeout > 0) {
      timer = setTimeout(onTimeout, timeout);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    }

    const onData = chunk => {
      if (aborted) {
        return;
      }
      const piece = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      raw += piece;
      bytesReceived += piece.length;
      if (bytesReceived > limit) {
        aborted = true;
        cleanup();
        req.destroy();
        reject(new Error('Payload too large'));
      }
    };

    const onEnd = () => {
      if (aborted) {
        return;
      }
      cleanup();
      if (raw.length === 0) {
        if (!allowEmpty) {
          reject(new Error('Empty JSON payload'));
          return;
        }
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('close', onClose);
    req.on('aborted', onAbortEvent);
  });
}

module.exports = {
  parseJsonBody
};
