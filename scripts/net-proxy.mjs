/**
 * Make Node's fetch honour HTTP(S)_PROXY.
 *
 * curl and Python both read these variables; Node's fetch (undici) ignores
 * them entirely. This environment reaches api.siliconflow.cn directly but
 * routes api.supabase.com through a local proxy, so without this bootstrap the
 * ingestion dies with UND_ERR_CONNECT_TIMEOUT on its first SQL call — after
 * the chunking has already run, which reads like a code bug and is not one.
 *
 * undici is present in the dependency tree. If it ever is not, assume a direct
 * route rather than failing the run.
 */
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
if (PROXY) {
  try {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new ProxyAgent(PROXY));
  } catch { /* no undici available — carry on with a direct connection */ }
}
export const proxyActive = !!PROXY;
