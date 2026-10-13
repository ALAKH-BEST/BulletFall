  window.addEventListener('error', function (e) {
    var el = document.getElementById('load-error');
    var msg = document.getElementById('load-error-msg');
    if (el && msg && el.classList.contains('hidden')) {
      msg.textContent = (e.message || 'Unknown script error') + (e.filename ? ' (' + e.filename + ')' : '');
      el.classList.remove('hidden');
    }
  });
