/**
 * Show confirmation dialog with Yes/No buttons
 * @param {string} message - Dialog message
 * @param {function} onYes - Callback when Yes button clicked
 * @param {function} onNo - Callback when No button clicked (optional)
 * @param {object} options - Additional options (title, yesText, noText, isDangerous)
 */
function showConfirmationDialog(message, onYes, onNo = null, options = {}) {
  const {
    title = 'Confirmation',
    yesText = 'Yes',
    noText = 'No',
    isDangerous = false // If true, Yes button is red
  } = options;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
  `;

  // Create dialog container
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 24px;
    border: 3px solid #3b3b3b;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease;
    overflow: hidden;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, #FFC107 0%, #FFD54F 100%);
    padding: 16px;
    border-bottom: 3px solid #FFA000;
    text-align: center;
  `;
  header.innerHTML = `<h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">${title}</h2>`;

  // Create content
  const content = document.createElement('div');
  content.style.cssText = `
    padding: 24px;
    font-size: 14px;
    color: #333;
    line-height: 1.6;
    text-align: center;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  content.textContent = message;

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid #E0E0E0;
  `;

  // Create No button
  const noBtn = document.createElement('button');
  noBtn.textContent = noText;
  noBtn.style.cssText = `
    flex: 1;
    background: white;
    border: 2px solid #E0E0E0;
    color: #1a1a1a;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  `;

  noBtn.onmouseover = () => {
    noBtn.style.borderColor = '#FFC107';
    noBtn.style.background = '#FFFBF0';
  };
  noBtn.onmouseout = () => {
    noBtn.style.borderColor = '#E0E0E0';
    noBtn.style.background = 'white';
  };

  noBtn.onclick = () => {
    closeDialog();
    if (onNo) onNo();
  };

  // Create Yes button
  const yesBtn = document.createElement('button');
  yesBtn.textContent = yesText;
  const yesBackground = isDangerous 
    ? 'linear-gradient(135deg, #FF6B6B 0%, #FF8787 100%)' 
    : 'linear-gradient(135deg, #FFC107 0%, #FFD54F 100%)';
  const yesShadow = isDangerous
    ? '0 4px 16px rgba(255, 107, 107, 0.3)'
    : '0 4px 16px rgba(255, 193, 7, 0.3)';

  yesBtn.style.cssText = `
    flex: 1;
    background: ${yesBackground};
    color: #1a1a1a;
    border: none;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: ${yesShadow};
  `;

  yesBtn.onmouseover = () => {
    yesBtn.style.transform = 'translateY(-2px)';
    yesBtn.style.boxShadow = isDangerous
      ? '0 6px 24px rgba(255, 107, 107, 0.4)'
      : '0 6px 24px rgba(255, 193, 7, 0.4)';
  };

  yesBtn.onmouseout = () => {
    yesBtn.style.transform = 'translateY(0)';
    yesBtn.style.boxShadow = yesShadow;
  };

  yesBtn.onclick = () => {
    closeDialog();
    if (onYes) onYes();
  };

  // Close dialog function
  function closeDialog() {
    overlay.style.animation = 'fadeOut 0.2s ease forwards';
    dialog.style.animation = 'slideDown 0.2s ease forwards';
    setTimeout(() => {
      overlay.remove();
    }, 200);
  }

  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      closeDialog();
      if (onNo) onNo();
    }
  };

  // Add animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(20px); opacity: 0; }
    }
  `;
  if (!document.querySelector('#confirmation-dialog-styles')) {
    style.id = 'confirmation-dialog-styles';
    document.head.appendChild(style);
  }

  // Assemble dialog
  buttonContainer.appendChild(noBtn);
  buttonContainer.appendChild(yesBtn);

  dialog.appendChild(header);
  dialog.appendChild(content);
  dialog.appendChild(buttonContainer);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Focus Yes button
  yesBtn.focus();
}

// Example usage:
// showConfirmationDialog(
//   'Are you sure you want to delete this file?',
//   () => console.log('Deleted'),
//   () => console.log('Cancelled'),
//   { title: 'Delete File', yesText: 'Delete', noText: 'Cancel', isDangerous: true }
// );
