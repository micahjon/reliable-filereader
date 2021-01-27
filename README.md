# Reliable FileReader

FileReader + Promises + Timeout Period

-   Wraps FileReader onload/onerror events with a Promise for ease of use.
-   Enforces a timeout period in case FileReader does not call onload or onerror within a reasonable timeframe. In some cases, we've found that FileReader just stalls out and never fires an event.
-   Native FileReader will actually call both onload & onerror if an error is thrown downstream in an onload callback, so by using this library you avoid that footgun.

## Getting Started

_Let me know if you actually use this and I'll start publishing it to npm. In the meantime:_

```bash
npm i git+https://github.com/micahjon/reliable-filereader.git
```

```js
import reliableFileReader from 'reliable-filereader';

reliableFileReader('readAsDataURL', blob)
    .then((base64String) => {
        // Do something with base64 string
    })
    .catch((error) => {
        if (/timed out/.test(error)) {
            // FileReader took longer than 10 seconds
        } else {
            // FileReader fired an error event.
            const errorEvent = error;
        }
    });
```

### Parameters

#### method {string}

Name of FileReader method (e.g. "readAsDataURL")

#### blob {Blob}

Blob or File to read

#### options.timeoutMs {number}

Milliseconds to wait before timing out. Defaults to **30 seconds**.

```js
// Only wait 10 seconds before giving up
reliableFileReader('readAsDataURL', blob, { timeoutMs: 10000 });
```

#### options.onFinishAfterTimeout {function}

Passed { error } or { result } when FileReader completes _after_ timeout period. Could be useful for determing the ideal timeout period.

```js
const startTime = Date.now();
reliableFileReader('readAsDataURL', blob, {
    onFinishAfterTimeout: ({ result, error }) => {
        const ellapsedSeconds = (Date.now() - startTime) / 1000;
        if (result) {
            reportToAnalytics(`FileReader completed after ${ellapsedSeconds}s`);
        } else {
            reportToAnalytics(`FileReader failed after ${ellapsedSeconds}s`);
        }
    },
});
```

#### timeoutFunction {function}

The timeout function to be overriden.
By default, it's just a simple wrapper around setTimeout that accepts a callback {function} and timeoutMs {number} and returns a cancellation function, e.g.

```js
function simpleTimeout(callback, timeoutMs) {
    const timeoutId = setTimeout(callback, timeoutMs);
    return stopWaiting;

    function stopWaiting() {
        clearTimeout(timeoutId);
    }
}
```

If you want to pause the timer while the tab is in the background, you could use this drop-in replacement:

```js
import whileTabVisibleTimeout from 'while-tab-visible-setTimeout';

// Pause timer if user is not viewing this tab, since FileReader will be throttled
// by the browser and will take much longer to complete its task.
reliableFileReader('readAsDataURL', blob, { timeoutFunction: whileTabVisibleTimeout });
```

See [micahjon/while-tab-visible-setTimeout](https://github.com/micahjon/while-tab-visible-setTimeout)
