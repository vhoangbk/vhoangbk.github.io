document.addEventListener('DOMContentLoaded', () => {
    const lastUpdateElement = document.getElementById('id-last-update');
    if (lastUpdateElement) {
      fetch('/build-info.json').then(response => {
        return response.json();
      }).then(json => {
        const lastModified = json.buildTime ? new Date(json.buildTime) : new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        lastUpdateElement.textContent = `Last updated: ${lastModified.toLocaleDateString(undefined, options)}`;
      })
    }
})