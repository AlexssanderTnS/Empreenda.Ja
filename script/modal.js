(() => {
  const messageQueue = [];
  let overlay;
  let confirmBtn;
  let messageContainer;
  let isInitialized = false;
  let isInitializing = false;
  let isModalOpen = false;

  function handleOverlayClick(event) {
    if (event.target === overlay) {
      closeModal();
    }
  }

  function handleEsc(event) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  function closeModal() {
    if (!overlay) {
      return;
    }

    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    overlay.removeEventListener("click", handleOverlayClick);
    document.removeEventListener("keydown", handleEsc);
    isModalOpen = false;
    flushQueue();
  }

  function showModal(message) {
    if (!isInitialized) {
      return;
    }

    messageContainer.textContent = message;
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
    overlay.addEventListener("click", handleOverlayClick);
    document.addEventListener("keydown", handleEsc);
    isModalOpen = true;

    if (confirmBtn) {
      requestAnimationFrame(() => confirmBtn.focus({ preventScroll: true }));
    }
  }

  function flushQueue() {
    if (!isInitialized || isModalOpen || messageQueue.length === 0) {
      return;
    }

    showModal(messageQueue.shift());
  }

  function ensureModalElements() {
    if (isInitialized) {
      return;
    }

    if (!document.body) {
      if (!isInitializing) {
        isInitializing = true;
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            isInitializing = false;
            ensureModalElements();
          },
          { once: true }
        );
      }
      return;
    }

    isInitializing = true;

    const style = document.createElement("style");
    style.textContent = `
      .alert-modal-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.55);
        padding: 1.5rem;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease-in-out;
        font-family: "Inter", "Segoe UI", sans-serif;
      }

      .alert-modal-overlay.is-visible {
        opacity: 1;
        pointer-events: all;
      }

      .alert-modal {
        width: min(420px, 100%);
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 24px 48px rgba(31, 41, 55, 0.25);
        overflow: hidden;
        animation: alertModalScale 0.25s ease;
      }

      @keyframes alertModalScale {
        from {
          transform: translateY(10px) scale(0.97);
          opacity: 0.6;
        }
        to {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }

      .alert-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem 0.75rem;
        border-bottom: 1px solid #f0f0f0;
      }

      .alert-modal__title {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0;
        color: #111827;
      }

      .alert-modal__close {
        border: none;
        background: transparent;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        color: #6b7280;
        transition: color 0.2s ease;
      }

      .alert-modal__close:hover,
      .alert-modal__close:focus {
        color: #111827;
      }

      .alert-modal__body {
        padding: 1rem 1.25rem 1.25rem;
        color: #374151;
        font-size: 1rem;
        line-height: 1.5;
        word-break: break-word;
      }

      .alert-modal__footer {
        padding: 0 1.25rem 1.25rem;
        display: flex;
        justify-content: flex-end;
      }

      .alert-modal__action {
        background-color: #2563eb;
        border: none;
        color: #ffffff;
        border-radius: 8px;
        padding: 0.6rem 1.25rem;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }

      .alert-modal__action:hover,
      .alert-modal__action:focus {
        background-color: #1d4ed8;
      }
    `;

    document.head.appendChild(style);

    overlay = document.createElement("div");
    overlay.id = "modalAlerta";
    overlay.className = "alert-modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <div class="alert-modal" role="dialog" aria-modal="true" aria-labelledby="modalAlertaTitulo">
        <div class="alert-modal__header">
          <h2 class="alert-modal__title" id="modalAlertaTitulo">Aviso</h2>
          <button type="button" class="alert-modal__close" aria-label="Fechar aviso">&times;</button>
        </div>
        <div class="alert-modal__body" id="modalMensagem"></div>
        <div class="alert-modal__footer">
          <button type="button" class="alert-modal__action" id="modalConfirmar">Entendi</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".alert-modal__close");
    confirmBtn = overlay.querySelector("#modalConfirmar");
    messageContainer = overlay.querySelector("#modalMensagem");

    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
    if (confirmBtn) {
      confirmBtn.addEventListener("click", closeModal);
    }

    isInitialized = true;
    isInitializing = false;
    flushQueue();
  }

  window.alert = (message = "") => {
    messageQueue.push(String(message));
    ensureModalElements();
    flushQueue();
  };
})();
