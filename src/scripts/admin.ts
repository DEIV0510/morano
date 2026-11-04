// Panel: confirmación antes de acciones destructivas, menú móvil y vista
// previa de imágenes. El servidor exige además confirmed=1 en esas acciones.
const dialog = document.querySelector<HTMLDialogElement>('[data-confirm-dialog]');
const text = dialog?.querySelector<HTMLElement>('[data-confirm-text]');

document.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  const msg = form.dataset.confirm;
  if (!msg || form.dataset.confirmed === '1' || !dialog || !text) return;
  e.preventDefault();
  text.textContent = msg;
  dialog.returnValue = '';
  dialog.showModal();
  dialog.addEventListener(
    'close',
    () => {
      if (dialog.returnValue !== 'ok') return;
      form.dataset.confirmed = '1';
      let hidden = form.querySelector<HTMLInputElement>('input[name=confirmed]');
      if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'confirmed';
        form.append(hidden);
      }
      hidden.value = '1';
      form.requestSubmit((e as SubmitEvent).submitter as HTMLElement | null);
    },
    { once: true }
  );
});

// Menú lateral plegado en móvil.
const nav = document.querySelector<HTMLDetailsElement>('[data-adm-nav]');
if (nav && matchMedia('(max-width: 900px)').matches) nav.open = false;

// Vista previa de la imagen antes de subirla.
document.querySelectorAll<HTMLInputElement>('input[type=file][data-preview]').forEach((input) => {
  const img = document.getElementById(input.dataset.preview!) as HTMLImageElement | null;
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!img || !f) return;
    img.src = URL.createObjectURL(f);
    img.hidden = false;
  });
});

// Envío de filtros al cambiar un select.
document.querySelectorAll<HTMLSelectElement>('select[data-autosubmit]').forEach((s) =>
  s.addEventListener('change', () => s.form?.requestSubmit())
);
