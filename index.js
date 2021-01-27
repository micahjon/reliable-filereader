/**
 * A Promise-based wrapper that makes calling FileReader more reliable.
 * Enforces a timeout period in case FileReader does not call onload or
 * onerror within a reasonable timeframe.
 * Native FileReader will actually call both onload & onerror if an error
 * is thrown downstream in an onload callback, so we avoid that footgun.
 *
 * @param {string} method - Name of FileReader method (e.g. "readAsDataURL")
 * @param {Blob} blob - Blob or File to read
 * @param {number} [timeoutMs] - Milliseconds to wait before timing out
 * @param {function} [onFinishAfterTimeout] - Passed { error } or { result }
 *                 when FileReader completes *after* timeout period. Could be
 *                 useful for determing the ideal timeout period.
 * @param {function} [timeoutFunction] - Allow timeout function to be overriden.
 *                 Should accept callback & timeoutMs parameters and return a
 *                 cancellation function. For instance, you could use:
 *                 https://github.com/micahjon/while-tab-visible-setTimeout
 * @return {Promise} Resolves with FileReader result or rejects with error.
 */
export default function reliableFileReader(
    method,
    blob,
    {
        timeoutMs = 30000,
        onFinishAfterTimeout = () => {},
        timeoutFunction = simpleTimeout,
    } = {}
) {
    return new Promise((resolve, reject) => {
        // Validate blob
        if (!(blob instanceof Blob)) {
            throw new Error(`Invalid blob passed to FileReader: ${blob}`);
        }

        // Validate method
        if (typeof FileReader.prototype[method] !== 'function') {
            throw new Error(`Invalid method passed to FileReader: ${method}`);
        }

        // Validate timeoutMs
        if (typeof timeoutMs !== 'number') {
            throw new Error(`Invalid timeoutMs passed to FileReader: ${timeoutMs}`);
        }

        // Validate onFinishAfterTimeout
        if (typeof onFinishAfterTimeout !== 'function') {
            throw new Error(
                `Invalid onFinishAfterTimeout passed to FileReader: ${onFinishAfterTimeout}`
            );
        }

        // Validate timeoutFunction
        if (typeof timeoutFunction !== 'function') {
            throw new Error(
                `Invalid timeoutFunction passed to FileReader: ${timeoutFunction}`
            );
        }

        // Reject early if FileReader takes longer than timeoutMs
        let hasTimedOut = false;
        let stopWaitingForTimeout = timeoutFunction(() => {
            hasTimedOut = true;
            reject(new Error(`FileReader ${method} timed out after ${timeoutMs}ms`));

            // Stop attempting to read file
            fileReader.abort();
        }, timeoutMs);

        // Process file
        fileReader.onload = () => onComplete({ result: fileReader.result });
        fileReader.onerror = (error) => onComplete({ error });
        fileReader[method](blob);

        // Handle result or error
        function onComplete({ result, error }) {
            // We're too late: timeout already rejected Promise.
            // We still expose the result in case it's still useful, for instance,
            // to figure out whether waiting longer would have helped
            if (hasTimedOut) {
                return onFinishAfterTimeout({ result, error });
            }

            // Clean up timer
            stopWaitingForTimeout();

            // Good news, FileReader responded before it timed out
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        }
    });
}

/**
 * Functional wrapper around setTimeout
 * Has the same API as whileTabVisibleTimeout in case the user opts out of that
 * @param {function} callback
 * @param {number} timeoutMs
 * @param {function} stopWaiting
 */
function simpleTimeout(callback, timeoutMs) {
    const timeoutId = setTimeout(callback, timeoutMs);
    return stopWaiting;

    function stopWaiting() {
        clearTimeout(timeoutId);
    }
}
