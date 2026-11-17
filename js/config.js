/* Configuração de ambiente do Colabre.
   - Deixe vazio ('') quando o frontend e o backend rodam no mesmo domínio.
   - Para GitHub Pages (frontend) + backend em outro domínio, defina a URL base do backend:
       window.COLABRE_API_BASE = 'https://seu-backend.com';
   - Também é possível definir em tempo de execução via localStorage:
       localStorage.setItem('colabre_api_base', 'https://seu-backend.com');
*/
(function () {
  try {
    var stored = localStorage.getItem('colabre_api_base');
    if (stored) { window.COLABRE_API_BASE = stored; return; }
  } catch (_) {}
  // Edite a linha abaixo para apontar para o seu backend público.
  window.COLABRE_API_BASE = '';
})();