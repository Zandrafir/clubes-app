const form = document.getElementById('form-login');
const alertBox = document.getElementById('alert-box');

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  alertBox.hidden = true;

  const senha = document.getElementById('senha').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alertBox.textContent = data.erro || 'Senha incorreta.';
      alertBox.hidden = false;
      return;
    }

    window.location.href = '/admin/';
  } catch (err) {
    alertBox.textContent = 'Erro de conexão. Tente novamente.';
    alertBox.hidden = false;
  }
});
