const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const senderModuleUrl = pathToFileURL(path.resolve(__dirname, '../services/Sender.js')).href;

const loadSender = () => import(`${senderModuleUrl}?t=${Date.now()}`);

describe('Sender HTTP client', () => {
    it('returns parsed json for successful responses', async () => {
        const mod = await loadSender();
        const { default: Sender, __setHttpClient } = mod;

        __setHttpClient(async () => ({
            status: 200,
            data: { ok: true },
        }));

        const res = await Sender.getWithPromise('/api/example');
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.json, { ok: true });
        assert.strictEqual(res.isFailed(), false);
    });

    it('marks responses without json as failed', async () => {
        const mod = await loadSender();
        const { default: Sender, __setHttpClient } = mod;

        __setHttpClient(async () => ({
            status: 204,
            data: '',
        }));

        const res = await Sender.getWithPromise('/api/no-content');
        assert.strictEqual(res.status, 204);
        assert.deepStrictEqual(res.json, { failed: true });
        assert.strictEqual(res.isFailed(), true);
    });

    it('surfaces error responses', async () => {
        const mod = await loadSender();
        const { default: Sender, __setHttpClient } = mod;

        __setHttpClient(async () => {
            const error = new Error('Network error');
            error.response = {
                status: 503,
                data: { failed: true, reason: 'service unavailable' },
            };
            throw error;
        });

        const res = await Sender.postWithPromise('/api/error', { foo: 'bar' });
        assert.strictEqual(res.status, 503);
        assert.deepStrictEqual(res.json, { failed: true, reason: 'service unavailable' });
        assert.strictEqual(res.isFailed(), true);
    });

    it('includes error message when no response payload is present', async () => {
        const mod = await loadSender();
        const { default: Sender, __setHttpClient } = mod;

        __setHttpClient(async () => {
            throw new Error('socket hang up');
        });

        const res = await Sender.getWithPromise('/api/network-error');
        assert.strictEqual(res.status, 0);
        assert.deepStrictEqual(res.json, { failed: true, reason: 'socket hang up' });
        assert.strictEqual(res.isFailed(), true);
    });
});
