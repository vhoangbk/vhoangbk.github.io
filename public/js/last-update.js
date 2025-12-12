document.addEventListener('DOMContentLoaded', () => {
    const lastUpdateElement = document.getElementById('id-last-update');
    if (lastUpdateElement) {
        const lastModified = new Date(document.lastModified);
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        lastUpdateElement.textContent = `Last Updated: ${lastModified.toLocaleDateString(undefined, options)}`;
    }
})