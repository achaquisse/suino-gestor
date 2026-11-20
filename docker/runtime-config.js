// Serves /config.js from the container's environment, so the Supabase project is chosen at
// `docker run` time and nothing is written to disk.
function pick(name) {
  return process.env[name] || process.env['VITE_' + name] || ''
}

function config(r) {
  const body = JSON.stringify({
    SUPABASE_URL: pick('SUPABASE_URL'),
    SUPABASE_PUBLISHABLE_KEY: pick('SUPABASE_PUBLISHABLE_KEY'),
  }).replace(/</g, '\\u003c')
  r.headersOut['Content-Type'] = 'application/javascript; charset=utf-8'
  r.return(200, 'window.__SUINO_GESTOR_CONFIG__ = ' + body + '\n')
}

export default { config }
